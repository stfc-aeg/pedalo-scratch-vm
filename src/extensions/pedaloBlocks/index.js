// Core, Team, and Official extensions can `require` VM code:
const BlockType = require('../../extension-support/block-type');
const ArgumentType = require('../../extension-support/argument-type');

// ...or VM dependencies:
const formatMessage = require('format-message');

// Core, Team, and Official extension classes should be registered statically with the Extension Manager.
// See: scratch-vm/src/extension-support/extension-manager.js
class PedaloBlocks {
    constructor (runtime) {
        /**
         * Store this for later communication with the Scratch VM runtime.
         * If this extension is running in a sandbox then `runtime` is an async proxy object.
         * @type {Runtime}
         */
        this.runtime = runtime;
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
                    opcode: 'myReporter', // becomes 'PedaloBlocks.myReporter'
                    text: formatMessage({
                        id: 'pedaloBlocks.myReporter',
                        default: 'This will return a string',
                        description: 'The first block to be created'
                    }),
                    blockType: BlockType.REPORTER
                },
                {
                    opcode: 'changeColor',
                    text: formatMessage({
                        id: 'pedaloBlocks.changeColor',
                        default: 'Change colour',
                        description: 'Testing command block'
                    }),
                    blockType: BlockType.COMMAND
                },
                {
                    opcode: 'talkToServer',
                    text: formatMessage({
                        id: 'pedaloBlocks.sendMessage',
                        default: 'Send Command with argument [ARGS]',
                        description: 'Testing command block'
                    }),
                    blockType: BlockType.COMMAND,
                    arguments: {
                        ARGS: {
                            type: ArgumentType.STRING,
                            defaultValue: 'defaultArgs'
                        }
                    }
                }
            ]
        };
    }

    myReporter (){
        const message = JSON.stringify({Command: 'Test Message', Args: ''});
        return new Promise((resolve => {
            this.connection().then(server => {
                const ws = server;
                ws.send(message);
                ws.onmessage = function (event) {
                    ws.close();
                    resolve(event.data);
                };
            });
        }));
    }

    connection () {
        return new Promise((resolve => {
            const server = new WebSocket('ws://localhost:8888');
            server.onopen = function () {
                resolve(server);
            };
        }));
    }

    // Color ranges from 0 to 200 where 0 is original orange
    changeColor (args, util){
        util.target.setEffect('color', util.target.effects.color + 10);
        return util.target.effects.color;
    }

    talkToServer (args){
        const message = JSON.stringify({Command: 'Set offset', Args: args.ARGS});
        return new Promise((resolve => {
            this.connection().then(server => {
                const ws = server;
                ws.send(message);
                ws.onmessage = function (event) {
                    ws.close();
                    resolve(event.data);
                };
            });
        }));
    }

}

module.exports = PedaloBlocks;
