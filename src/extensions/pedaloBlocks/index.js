// Core, Team, and Official extensions can `require` VM code:
const BlockType = require('../../extension-support/block-type');
const ArgumentType = require('../../extension-support/argument-type');
const http = require('http');
const formatMessage = require('format-message');

// Core, Team, and Official extension classes should be registered statically with the Extension Manager.
// See: scratch-vm/src/extension-support/extension-manager.js

class Pedalo {
    constructor (runtime, extensionId){
        this._runtime = runtime;
        this.ble = null;
        this._runtime.registerPeripheralExtension(extensionId, this);
        this._extensionId = extensionId;
    }

}
class PedaloBlocks {
    constructor (runtime) {
        /**
         * Store this for later communication with the Scratch VM runtime.
         * If this extension is running in a sandbox then `runtime` is an async proxy object.
         * @type {Runtime}
         */
        this.runtime = runtime;
        this.dict = new Map();
        this._peripheral = new Pedalo(this.runtime, 'pedalo');
        this.readingsMenu = [{value: 0, text: ''}, {value: 0, text: ''}];
        this._penSkinId = -1;
        this._penDrawableId = -1;
    }

    /**
     * @return {object} This extension's metadata.
     */
    getInfo () {
        return {
            id: 'pedaloBlocks',
            name: formatMessage({
                id: 'extensionName',
                default: 'PEDALO blocks',
                description: 'The name of the "PedaloBlocks" extension'
            }),
            blocks: [
                {
                    opcode: 'getTemperature',
                    text: formatMessage({
                        id: 'pedaloBlocks.myReporter',
                        default: 'Get temperature from sensor',
                        description: 'Use this block to get temperature from sensor'
                    }),
                    blockType: BlockType.REPORTER
                },
                {
                    opcode: 'openGraph',
                    text: formatMessage({
                        id: 'pedaloBlocks.test',
                        default: 'Show graph',
                        description: 'Use this block to show graph'
                    }),
                    blockType: BlockType.COMMAND
                },
                {
                    opcode: 'changeColor',
                    text: formatMessage({
                        id: 'pedaloBlocks.changeColor',
                        default: 'Change colour to [COLOUR]',
                        description: 'Testing command block'
                    }),
                    blockType: BlockType.COMMAND,
                    arguments: {
                        COLOUR: {
                            type: ArgumentType.COLOR,
                            menu: 'colours',
                            defaultValue: '100'
                        }
                    }
                },
                {
                    opcode: 'writeToFile',
                    text: formatMessage({
                        id: 'pedaloBlocks.writeToFile',
                        default: 'Write to CSV file [WRITE]',
                        description: 'Use this block to write to csv file'
                    }),
                    blockType: BlockType.COMMAND,
                    arguments: {
                        WRITE: {
                            type: ArgumentType.BOOLEAN,
                            defaultValue: true
                        }
                    }
                },
                {
                    opcode: 'penDown',
                    text: formatMessage({
                        id: 'pedaloBlocks.getChannels',
                        default: 'Draw line',
                        description: 'Use this block to get available channels from sensor'
                    }),
                    blockType: BlockType.COMMAND
                },
                {
                    opcode: 'getReadings',
                    text: formatMessage({
                        id: 'pedaloBlocks.getData',
                        default: 'Get [READING] from sensor',
                        description: 'Use this block to get data from sensor'
                    }),
                    blockType: BlockType.REPORTER,
                    arguments: {
                        READING: {
                            type: ArgumentType.STRING,
                            menu: 'readings',
                            defaultValue: 'Temperature'
                        }
                    }
                }
            ],
            menus: {
                readings: 'returnReadingMenu',
                colours: {
                    items: [{value: 100, text: 'Blue'}, {value: 180, text: 'Red'}]
                }
            }
        };
    }
    /**
     * Method to retrieve all possible readings that are supported for connected server.
     */
    _getReadingsList (){
        const p = new Promise(resolve => {
            const req = http.request('localhost:8888/list', res => {
                res.on('data', d => {
                    const string = new TextDecoder().decode(d);
                    resolve((JSON.parse(string)).Keys);
                });
            });
            req.end();
        });
        p.then(result => {
            this.readingsMenu = result;
        });
    }

    /**
     * Method to return all supported keys that were retrieved by _getReadingsList.
     * @return {object} returned keys as array
     */
    returnReadingMenu (){
        this._getReadingsList();
        return this.readingsMenu;
    }

    /**
     * Methods to return temperature reading from sensor via websocket.
     * @param {string} args Arguments passed when calling this function
     * @param {object} util Utility information about sprite that called this function
     * @return {JSON} reading returned by server
     */
    getTemperature (args, util){
        const message = JSON.stringify({Command: 'get_temp_msg', Args: ''});
        const messageback = this._sendMessage(args, util, message);
        return messageback;
    }

    /**
     * Methods to enable and disable writing to file feature.
     * @param {string} args Arguments passed when calling this function
     * @param {object} util Utility information about sprite that called this function
     * @return {JSON} reply returned by server
     */
    writeToFile (args, util){
        const message = JSON.stringify({Command: 'change_csv_setting', Args: args.WRITE});
        const messageback = this._sendMessage(args, util, message);
        return messageback;
    }

    /**
     * Methods to open a new graph page in browser (not known if supported by desktop application)
     * @param {string} args Arguments passed when calling this function
     * @param {object} util Utility information about sprite that called this function
     */
    openGraph (args, util){
        const message = JSON.stringify({Command: 'plot_graph_msg', Args: ''});
        const messageback = this._sendMessage(args, util, message);
        window.open('localhost/graph');
    }
    /**
     * Methods to return all channels from sensor via websocket.
     * @param {string} args Arguments passed when calling this function
     * @param {object} util Utility information about sprite that called this function
     * @return {JSON} all available channels returned by server
     */
    getChannels (args, util){
        const message = JSON.stringify({Command: 'get_channels_msg', Args: ''});
        const messageback = this._sendMessage(args, util, message);
        return messageback;
    }
    /**
     * Methods to return any reading from sensor via websocket.
     * The reading retrieved is specified in args.READING argument
     * @param {string} args Arguments passed when calling this function
     * @param {object} util Utility information about sprite that called this function
     * @return {JSON} reading returned by server
     */
    getReadings (args, util){
        const message = JSON.stringify({Command: 'get_data_msg', Args: args.READING});
        const messageback = this._sendMessage(args, util, message);
        return messageback;
    }

    /**
     * Main method to communicate with server via websocket.
     * It sends a message and waits for reply.
     * @param {string} args Arguments passed when calling this function
     * @param {object} util Utility information about sprite that called this function
     * @param {object} message a message that will be sent to server
     * @return {Promise} Promise is used when waiting for reply from server
     */
    _sendMessage (args, util, message){
        const self = this;
        const spriteId = util.target.id;
        return new Promise((resolve => {
            this._connection(util).then(connected => {
                if (connected === true){
                    self.dict.get(spriteId).server.send(message);
                    self.dict.get(spriteId).server.onmessage = function (event) {
                        resolve(event.data);
                    };
                }
            });
        }));
    }
    /**
     * Main method to setup a connection via websocket.
     * Each sprite can have one websocket. If sprite already has a websocket
     * it does not create a new one, but just uses the old one.
     * @param {object} util Utility information about sprite that called this function
     * @return {Promise} Promise is used when waiting for socket to be opened
     */
    _connection (util) {
        const self = this;
        const spriteId = util.target.id;
        return new Promise((resolve => {
            if (self.dict.has(spriteId) && self.dict.get(spriteId).server.readyState === 1){
                resolve(true);
            } else {
                const server = new WebSocket('ws://localhost:8888');
                server.onopen = function () {
                    self.dict.set(spriteId, {server});
                    resolve(true);
                };
            }
        }));
    }

    // Color ranges from 0 to 200 where 0 is original orange
    changeColor (args, util){
        util.target.setEffect('color', args.COLOUR);
    }

}

module.exports = PedaloBlocks;
