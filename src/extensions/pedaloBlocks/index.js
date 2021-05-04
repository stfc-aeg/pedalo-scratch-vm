// Core, Team, and Official extensions can `require` VM code:
const BlockType = require('../../extension-support/block-type');
const ArgumentType = require('../../extension-support/argument-type');
const http = require('http');
const RenderedTarget = require('../../sprites/rendered-target');
const StageLayering = require('../../engine/stage-layering');
const Scratch3PenBlocks = require('../scratch3_pen/index');
const Clone = require('../../util/clone');


// ...or VM dependencies:
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

    scan () {
        console.log('This is scan');
    }

    connect () {
        console.log('This is connect');
    }

    disconnect () {
        console.log('This is disconnect');
    }

    reset () {
        console.log('This is reset');
    }

    isConnected () {
        console.log('Thi is connected');
    }

    send (command, message) {
        console.log('This is send');
    }

    _onConnect () {
        console.log('This is onConnect');
    }

    _onMessage (base64) {
        console.log('This is onMessage');

    }

    _checkPinState (pin) {
        console.log('This is checkPinState');
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
                    opcode: 'getTemperature', // becomes 'PedaloBlocks.myReporter'
                    text: formatMessage({
                        id: 'pedaloBlocks.myReporter',
                        default: 'Get the temperature from sensor',
                        description: 'Use this block to get temperature from sensor'
                    }),
                    blockType: BlockType.REPORTER
                },
                {
                    opcode: 'test',
                    text: formatMessage({
                        id: 'pedaloBlocks.test',
                        default: 'Test block',
                        description: 'Use this block to get temperature from sensor'
                    }),
                    blockType: BlockType.REPORTER
                },
                {
                    opcode: 'changeColor',
                    text: formatMessage({
                        id: 'pedaloBlocks.changeColor',
                        default: 'Change colour [COLOUR]',
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
                    opcode: 'getGasR',
                    text: formatMessage({
                        id: 'pedaloBlocks.getGasR',
                        default: 'Get gas resistance from sensor',
                        description: 'Use this block to get resistance from sensor'
                    }),
                    blockType: BlockType.REPORTER
                },
                {
                    opcode: 'writeToFile',
                    text: formatMessage({
                        id: 'pedaloBlocks.writeToFile',
                        default: 'Write to CSV file',
                        description: 'Use this block to get resistance from sensor'
                    }),
                    blockType: BlockType.COMMAND
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
                        default: 'Get all data [READING]',
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

    _getReadingsList (){
        const p = new Promise(resolve => {
            const req = http.request('http://192.168.1.159:8888/list', res => {
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

    returnReadingMenu (){
        this._getReadingsList();
        return this.readingsMenu;
    }

    _getPenLayerID () {
        if (this._penSkinId < 0 && this.runtime.renderer) {
            this._penSkinId = this.runtime.renderer.createPenSkin();
            this._penDrawableId = this.runtime.renderer.createDrawable(StageLayering.PEN_LAYER);
            this.runtime.renderer.updateDrawableSkinId(this._penDrawableId, this._penSkinId);
        }
        return this._penSkinId;
    }

    _getPenState (target) {
        let penState = target.getCustomState(Scratch3PenBlocks.STATE_KEY);
        if (!penState) {
            penState = Clone.simple(Scratch3PenBlocks.DEFAULT_PEN_STATE);
            target.setCustomState(Scratch3PenBlocks.STATE_KEY, penState);
        }
        return penState;
    }

    _onTargetMoved (target, oldX, oldY, isForce) {
        // Only move the pen if the movement isn't forced (ie. dragged).
        if (!isForce) {
            const penSkinId = this._getPenLayerID();
            if (penSkinId >= 0) {
                const penState = this._getPenState(target);
                this.runtime.renderer.penLine(penSkinId, penState.penAttributes, oldX, oldY, target.x, target.y);
                this.runtime.requestRedraw();
            }
        }
    }

    penDown (args, util) {
        const target = util.target;
        const penState = this._getPenState(target);

        if (!penState.penDown) {
            penState.penDown = true;
            target.addListener(RenderedTarget.EVENT_TARGET_MOVED, this._onTargetMoved);
        }

        const penSkinId = this._getPenLayerID();
        if (penSkinId >= 0) {
            this.runtime.renderer.penLine(penSkinId, penState.penAttributes, 0, 0, 100, 100);
            this.runtime.requestRedraw();
        }
    }

    getTemperature (args, util){
        const message = JSON.stringify({Command: 'get_temp_msg', Args: ''});
        const messageback = this._sendMessage(args, util, message);
        return messageback;
    }

    writeToFile (args, util){
        const message = JSON.stringify({Command: 'change_csv_setting', Args: ''});
        const messageback = this._sendMessage(args, util, message);
        return messageback;
    }

    test (args, util){
        const message = JSON.stringify({Command: 'plot_graph_msg', Args: ''});
        const messageback = this._sendMessage(args, util, message);
        return messageback;
    }

    getChannels (args, util){
        const message = JSON.stringify({Command: 'get_channels_msg', Args: ''});
        const messageback = this._sendMessage(args, util, message);
        return messageback;
    }

    getGasR (args, util){
        const message = JSON.stringify({Command: 'get_gas_r_msg', Args: ''});
        const messageback = this._sendMessage(args, util, message);
        return messageback;
    }

    getReadings (args, util){
        const message = JSON.stringify({Command: 'get_data_msg', Args: args.READING});
        const messageback = this._sendMessage(args, util, message);
        return messageback;
    }

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

    _connection (util) {
        const self = this;
        const spriteId = util.target.id;
        return new Promise((resolve => {
            if (self.dict.has(spriteId) && self.dict.get(spriteId).server.readyState === 1){
                resolve(true);
            } else {
                const server = new WebSocket('ws://192.168.1.159:8888');
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
