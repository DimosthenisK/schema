import * as sinon from "sinon";
import * as assert from "assert";
import * as nanoid from "nanoid";

import { DataChange } from './../src/annotations';
import { State, Player } from "./Schema";
import { MapSchema, ArraySchema } from "../src";

describe("Change API", () => {

    describe("Primitive types", () => {
        it("should trigger onChange with a single value", () => {
            const state = new State();
            state.fieldNumber = 50;

            const decodedState = new State();
            decodedState.onChange = function (changes: DataChange[]) {
                assert.equal(changes.length, 1);
                assert.equal(changes[0].field, "fieldNumber");
                assert.equal(changes[0].value, 50);
                assert.equal(changes[0].previousValue, undefined);
            }

            const onChangeSpy = sinon.spy(decodedState, 'onChange');

            decodedState.decode(state.encode());
            sinon.assert.calledOnce(onChangeSpy);
        })

        it("should trigger onChange with multiple values", () => {
            const state = new State();
            state.fieldNumber = 50;
            state.fieldString = "Hello world!";

            const decodedState = new State();
            decodedState.onChange = function (changes: DataChange[]) {
                assert.equal(changes.length, 2);
                assert.equal(changes[0].field, "fieldNumber");
                assert.equal(changes[0].value, 50);
                assert.equal(changes[0].previousValue, undefined);

                assert.equal(changes[1].field, "fieldString");
                assert.equal(changes[1].value, "Hello world!");
                assert.equal(changes[1].previousValue, undefined);
            }
            let onChangeSpy = sinon.spy(decodedState, 'onChange');

            decodedState.decode(state.encode());
            sinon.assert.calledOnce(onChangeSpy);

            state.fieldNumber = 100;
            state.fieldString = "Again";

            decodedState.onChange = function (changes: DataChange[]) {
                assert.equal(changes.length, 2);
                assert.equal(changes[0].field, "fieldNumber");
                assert.equal(changes[0].value, 100);
                assert.equal(changes[0].previousValue, 50);

                assert.equal(changes[1].field, "fieldString");
                assert.equal(changes[1].value, "Again");
                assert.equal(changes[1].previousValue, "Hello world!");
            }
            onChangeSpy = sinon.spy(decodedState, 'onChange');

            decodedState.decode(state.encode());
            sinon.assert.calledOnce(onChangeSpy);
        });

        it("should trigger onChange on child objects", () => {
            const state = new State();
            state.player = new Player("Jake", 10, 10);

            let playerSpy: sinon.SinonSpy;

            const decodedState = new State();
            decodedState.onChange = function (changes: DataChange[]) {
                assert.equal(changes.length, 1);
                assert.equal(changes[0].field, "player");

                // not having a previous value means this is a new object
                // which would only define the `onChange` function once per object.
                if (!changes[0].previousValue) {
                    const player = changes[0].value as Player;
                    player.onChange = function (changes: DataChange[]) {
                        assert.equal(changes.length, 1);
                        assert.equal(changes[0].field, "name");
                        assert.equal(changes[0].value, "Snake");
                        assert.equal(changes[0].previousValue, "Jake");
                    }

                    playerSpy = sinon.spy(player, 'onChange');
                }
            }
            let onChangeSpy = sinon.spy(decodedState, 'onChange');

            decodedState.decode(state.encode());
            sinon.assert.calledOnce(onChangeSpy);

            state.player.name = "Snake";

            // overwrite `onChange` for second decode
            decodedState.onChange = function (changes: DataChange[]) {
                assert.equal(changes.length, 1);
            }
            onChangeSpy = sinon.spy(decodedState, 'onChange');

            decodedState.decode(state.encode());
            sinon.assert.calledOnce(onChangeSpy);
            sinon.assert.calledOnce(playerSpy);
        });
    });

    describe("ArraySchema", () => {
        it("detecting onChange on arrays", () => {
            const state = new State();
            state.arrayOfPlayers = new ArraySchema(new Player("Jake Badlands"), new Player("Katarina Lyons"));

            const decodedState = new State();
            decodedState.arrayOfPlayers = new ArraySchema();
            decodedState.arrayOfPlayers.onAdd = function (player: Player) { }
            const onAddPlayerSpy = sinon.spy(decodedState.arrayOfPlayers, 'onAdd');

            decodedState.onChange = function (changes: DataChange[]) {
                assert.equal(changes.length, 1);
                assert.equal(changes[0].field, "arrayOfPlayers");
                assert.equal(changes[0].value.length, 2);

                assert.equal(changes[0].value[0].name, "Jake Badlands");
                assert.equal(changes[0].value[1].name, "Katarina Lyons");
            }

            let onChangeSpy = sinon.spy(decodedState, 'onChange');


            decodedState.decode(state.encode());
            sinon.assert.calledOnce(onChangeSpy);

            state.arrayOfPlayers.push(new Player("Snake Sanders"));
            decodedState.onChange = function (changes: DataChange[]) {
                assert.equal(changes.length, 1);
                assert.equal(changes[0].field, "arrayOfPlayers");
                assert.equal(changes[0].value.length, 1);

                assert.equal(changes[0].value[0].name, "Snake Sanders");
            }

            onChangeSpy = sinon.spy(decodedState, 'onChange');
            decodedState.decode(state.encode());
            sinon.assert.calledOnce(onChangeSpy);

            sinon.assert.calledThrice(onAddPlayerSpy);
        });

        it("detecting onRemove on array items", () => {
            const state = new State();
            state.arrayOfPlayers = new ArraySchema(new Player("Jake Badlands"), new Player("Katarina Lyons"));

            let katarina: Player;

            const decodedState = new State();
            decodedState.onChange = function (changes: DataChange[]) {
                katarina = changes[0].value[1];
                assert.ok(katarina instanceof Player);
            };

            let onChangeSpy = sinon.spy(decodedState, 'onChange');
            decodedState.decode(state.encode());
            sinon.assert.calledOnce(onChangeSpy);

            state.arrayOfPlayers.splice(1);

            katarina.onRemove = function () { }
            const onItemRemoveSpy = sinon.spy(katarina, "onRemove");

            decodedState.onChange = function (changes: DataChange[]) {
                assert.equal(changes.length, 1);
            }

            onChangeSpy = sinon.spy(decodedState, 'onChange');
            decodedState.decode(state.encode());
            sinon.assert.calledOnce(onChangeSpy);
            sinon.assert.calledOnce(onItemRemoveSpy);
        });
    });


    describe("MapSchema", () => {
        it("detecting onChange on maps", () => {
            const state = new State();
            state.mapOfPlayers = new MapSchema({
                'jake': new Player("Jake Badlands"),
                'katarina': new Player("Katarina Lyons"),
            });

            const decodedState = new State();
            decodedState.onChange = function (changes: DataChange[]) {
                assert.equal(changes.length, 1);
                assert.equal(changes[0].field, "mapOfPlayers");
                assert.equal(Object.keys(changes[0].value).length, 2);

                assert.equal(changes[0].value.jake.name, "Jake Badlands");
                assert.equal(changes[0].value.katarina.name, "Katarina Lyons");
            }

            let onChangeSpy = sinon.spy(decodedState, 'onChange');
            decodedState.decode(state.encode());
            sinon.assert.calledOnce(onChangeSpy);

            state.mapOfPlayers['snake'] = new Player("Snake Sanders");
            decodedState.onChange = function (changes: DataChange[]) {
                assert.equal(changes.length, 1);
                assert.equal(changes[0].field, "mapOfPlayers");
                assert.equal(Object.keys(changes[0].value).length, 3);

                assert.equal(changes[0].value.snake.name, "Snake Sanders");
            }

            onChangeSpy = sinon.spy(decodedState, 'onChange');
            decodedState.decode(state.encode());
            sinon.assert.calledOnce(onChangeSpy);
        });

        it("detecting multiple changes on item inside a map", () => {
            const state = new State();
            state.mapOfPlayers = new MapSchema({
                'jake': new Player("Jake Badlands")
            });

            const decodedState = new State();
            decodedState.decode(state.encode());

            decodedState.mapOfPlayers['jake'].onChange = function (changes: DataChange[]) { }
            let onChangeSpy = sinon.spy(decodedState.mapOfPlayers['jake'], 'onChange');

            state.mapOfPlayers['jake'].x = 100;
            let encoded = state.encode();
            decodedState.decode(encoded);

            state.mapOfPlayers['jake'].x = 200;
            encoded = state.encode();
            decodedState.decode(encoded);

            sinon.assert.calledTwice(onChangeSpy);
        })

        it("should call onAdd / onRemove on map", () => {
            const state = new State();
            state.mapOfPlayers = new MapSchema({
                'jake': new Player("Jake Badlands"),
            });

            const decodedState = new State();
            decodedState.decode(state.encode());

            decodedState.mapOfPlayers.onAdd = function (player: Player, key: string) {
                assert.ok(key);
            }
            decodedState.mapOfPlayers.onRemove = function (player: Player, key: string) {
                assert.ok(key);
            }

            // add two entries
            state.mapOfPlayers['snake'] = new Player("Snake Sanders");
            state.mapOfPlayers['katarina'] = new Player("Katarina Lyons");

            const onAddSpy = sinon.spy(decodedState.mapOfPlayers, 'onAdd');
            const onRemoveSpy = sinon.spy(decodedState.mapOfPlayers, 'onRemove');

            let encoded = state.encode();
            decodedState.decode(encoded);

            // remove one entry
            delete state.mapOfPlayers['snake'];
            encoded = state.encode();
            decodedState.decode(encoded);

            sinon.assert.calledTwice(onAddSpy);
            sinon.assert.calledOnce(onRemoveSpy);
        })

        it("should not loose reference when add / remove is performed at once", () => {
            const state = new State();
            state.mapOfPlayers = new MapSchema({
                [nanoid(8)]: new Player("food 1", Math.random() * 2000, Math.random() * 2000),
                [nanoid(8)]: new Player("food 2", Math.random() * 2000, Math.random() * 2000),
                'jake': new Player("Jake Badlands", Math.random() * 2000, Math.random() * 2000)
            });

            const decodedState = new State();
            decodedState.decode(state.encode());

            // increase "jake"'s radius, delete one food, insert another.
            state.mapOfPlayers['jake'].x += Math.random() * 2;
            state.mapOfPlayers['jake'].y += Math.random() * 2;
            state.mapOfPlayers[nanoid(8)] = new Player("food 3", Math.random() * 2000, Math.random() * 2000);
            delete state.mapOfPlayers[Object.keys(state.mapOfPlayers)[0]];
            decodedState.decode(state.encode());

            delete state.mapOfPlayers['jake'];
            decodedState.decode(state.encode());
        })
        
        it("should call onAdd 100 times", () => {
            const state = new State();
            state.mapOfPlayers = new MapSchema({
                'jake': new Player("Jake")
            });

            const decodedState = new State();
            decodedState.decode(state.encode());

            decodedState.mapOfPlayers.onAdd = function (player: Player, key: string) {
                assert.ok(key);
            }
            const onAddSpy = sinon.spy(decodedState.mapOfPlayers, 'onAdd');

            delete state.mapOfPlayers['jake'];
            for (let i = 0; i < 100; i++) {
                state.mapOfPlayers[i] = new Player("Player " + i, Math.random() * 2000, Math.random() * 2000);
            }

            let encoded = state.encode();
            decodedState.decode(encoded);

            assert.equal(Object.keys(decodedState.mapOfPlayers).length, 100);
            sinon.assert.callCount(onAddSpy, 100);
        })

        it("detecting onRemove on map items", () => {
            const state = new State();
            state.mapOfPlayers = new MapSchema({
                'jake': new Player("Jake Badlands"),
                'katarina': new Player("Katarina Lyons"),
            });

            let katarina: Player;

            const decodedState = new State();
            decodedState.onChange = function (changes: DataChange[]) {
                katarina = changes[0].value.katarina;
                assert.ok(katarina instanceof Player);
            }

            let onChangeSpy = sinon.spy(decodedState, 'onChange');
            decodedState.decode(state.encode());
            sinon.assert.calledOnce(onChangeSpy);

            delete state.mapOfPlayers['katarina'];
            katarina.onRemove = function () { }
            const onItemRemoveSpy = sinon.spy(katarina, "onRemove");

            decodedState.onChange = function (changes: DataChange[]) {
                assert.equal(changes.length, 1);
            }

            onChangeSpy = sinon.spy(decodedState, 'onChange');
            decodedState.decode(state.encode());
            sinon.assert.calledOnce(onChangeSpy);
            sinon.assert.calledOnce(onItemRemoveSpy);
        });
    })

});