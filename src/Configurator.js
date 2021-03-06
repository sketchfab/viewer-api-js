import 'babel-polyfill';
import Ajv from 'ajv';
import fetch from 'unfetch';
import isIFrame from './lib/isIFrame';
import parseQueryString from './lib/parseQueryString';
import Viewer from './Viewer';
import Options from './Options';
import OptionsView from './OptionsView';
const schema = require('./schema.json');

const ALLOW_EMBED = true;

/**
 * Main Configurator class
 */
class Configurator {
    /**
     * @param {object} iframeEl iframe DOM element for the viewer
     * @param {object} optionsEl Placeholder DOM element for the UI
     * @param {object} config Configuration object
     */
    constructor(iframeEl, optionsEl, config = null) {
        this.iframeEl = iframeEl;
        this.optionsEl = optionsEl;
        this.optionView = null;
        this.viewer = null;
        this.config = config;

        if (!ALLOW_EMBED && isIFrame()) {
            this._renderFatalError('This page is for preview only and cannot be embedded.');
            return;
        }

        let promiseConfig;

        if (this.config) {
            promiseConfig = Promise.resolve(this.config);
        } else {
            var parameters = parseQueryString(window.location.search);
            if (parameters.hasOwnProperty('config')) {
                console.log('Loading config from URL', parameters.config);
                promiseConfig = this._loadConfig(parameters.config);
            } else if (window.defaultConfigUrl) {
                console.log('Loading default config URL', window.defaultConfigUrl);
                promiseConfig = this._loadConfig(window.defaultConfigUrl);
            } else if (window.defaultConfig) {
                console.log('Loading config', window.defaultConfig);
                promiseConfig = Promise.resolve(window.defaultConfig);
            } else {
                promiseConfig = Promise.reject('No configuration found');
            }
        }

        promiseConfig
            .then(config => {
                let validation = this._validate(config);
                if (validation.valid === false) {
                    console.warn(validation.errors);
                }
                this.config = config;
                this._initialize();
            })
            .catch(error => {
                console.error(error);
            });
    }

    _initialize() {
        const config = this.config;
        this.viewer = new Viewer(
            iframeEl,
            config.model,
            () => {
                this.optionView = new OptionsView(
                    optionsEl,
                    new Options(config.config, this.viewer)
                );
            },
            {
                params: config.params ? config.params : {}
            }
        );
    }

    _renderFatalError(message) {
        const styles = `
            position: absolute;
            top: 0;
            left: 0;
            width: 96%;
            padding: 2%;
        `;
        const out = `<div style="${styles}">${message}</div>`;
        const div = document.createElement('DIV');
        div.innerHTML = out;
        document.body.appendChild(div);
    }

    _validate(config) {
        const ajv = new Ajv();
        const validate = ajv.compile(schema);
        const valid = validate(config);
        if (valid) {
            return {
                valid: true
            };
        } else {
            return {
                valid: false,
                errors: validate.errors
            };
        }
    }

    /**
     * Disposes the configurator
     */
    dispose() {
        this.optionView.dispose();
        this.viewer.dispose();
    }

    _loadConfig(url) {
        return fetch(url, {
            method: 'GET',
            mode: 'cors'
        }).then(function(response) {
            return response.json();
        });
    }
}

export default Configurator;
