import * as sinon from "sinon";
import * as util from "util";
import * as assert from "assert";

import { type, filter, Context } from './../src/annotations';
import { State, Player } from "./Schema";
import { Schema, MapSchema, ArraySchema, DataChange, Reflection } from "../src";

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

            const fieldNumberChange =  (value, previousValue) => assert.ok(value === 50);
            const onFieldNumberChangeSpy = sinon.spy(fieldNumberChange);
            decodedState.listen("fieldNumber", onFieldNumberChangeSpy);

            decodedState.decode(state.encode());
            sinon.assert.calledOnce(onChangeSpy);
            sinon.assert.calledOnce(onFieldNumberChangeSpy);
        });

        it("should trigger onChange with multiple values", () => {
            const state = new State();
            state.fieldString = "Hello world!";
            state.fieldNumber = 50;

            const decodedState = new State();
            decodedState.onChange = function (changes: DataChange[]) {
                assert.equal(changes.length, 2);

                assert.equal(changes[0].field, "fieldString");
                assert.equal(changes[0].value, "Hello world!");
                assert.equal(changes[0].previousValue, undefined);

                assert.equal(changes[1].field, "fieldNumber");
                assert.equal(changes[1].value, 50);
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
                console.log("CHANGES =>", changes);
                assert.equal(changes.length, 1);
                assert.equal(changes[0].field, "player");
            }
            let rootOnChangeSpy = sinon.spy(decodedState, 'onChange');

            decodedState.decode(state.encode());
            sinon.assert.calledOnce(rootOnChangeSpy);

            state.player.name = "Snake";

            decodedState.player.onChange = function (changes: DataChange[]) {
                assert.equal(changes.length, 1);
                assert.equal(changes[0].field, "name");
                assert.equal(changes[0].value, "Snake");
                assert.equal(changes[0].previousValue, "Jake");
            }
            playerSpy = sinon.spy(decodedState.player, 'onChange');

            // overwrite `onChange` for second decode
            decodedState.onChange = function (changes: DataChange[]) {}
            rootOnChangeSpy = sinon.spy(decodedState, 'onChange');

            decodedState.decode(state.encode());
            sinon.assert.notCalled(rootOnChangeSpy);
            sinon.assert.calledOnce(playerSpy);
        });

        it("should trigger onChange and onRemove when removing child object", () => {
            const state = new State();
            state.player = new Player("Jake", 10, 10);

            const decodedState = new State();
            decodedState.decode(state.encode());

            decodedState.onChange = function (changes: DataChange[]) {}
            const onChangeSpy = sinon.spy(decodedState, 'onChange');

            decodedState.player.onRemove = () => {};
            const onRemoveSpy = sinon.spy(decodedState.player, 'onRemove');

            state.player = null;
            decodedState.decode(state.encode());

            sinon.assert.calledOnce(onChangeSpy);
            sinon.assert.calledOnce(onRemoveSpy);
        });
    });

    describe("Re-assignments", () => {
        it("should not trigger change if value is changed back and forth to same value", () => {
            class State extends Schema {
                @type("boolean") bool: boolean;
            }

            const state = new State();
            state.bool = false;

            const decodedState = new State();

            let changeCallCount: number = 0;
            decodedState.listen("bool", (value) => changeCallCount++);

            decodedState.decode(state.encode());

            state.bool = true;
            state.bool = false;

            decodedState.decode(state.encode());

            assert.equal(1, changeCallCount);
        })
    });

    describe("ArraySchema", () => {
        it("detecting onChange on arrays", () => {
            const state = new State();
            state.arrayOfPlayers = new ArraySchema(new Player("Jake Badlands"), new Player("Katarina Lyons"));

            const decodedState = new State();
            decodedState.arrayOfPlayers = new ArraySchema();

            let callCount: number = 0;
            decodedState.arrayOfPlayers.onAdd = function (item: Player, key: number) {
                if (callCount === 0) {
                    assert.equal(item.name, "Jake Badlands");
                    assert.equal(0, key);

                } else if (callCount === 1) {
                    assert.equal(item.name, "Katarina Lyons");
                    assert.equal(1, key);

                } else if (callCount === 2) {
                    assert.equal(item.name, "Snake Sanders");
                    assert.equal(2, key);
                }

                callCount++;
            }
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

            decodedState.decode(state.encode());
            sinon.assert.calledThrice(onAddPlayerSpy);
        });

        it("detecting onChange on array holder", () => {
            class MyState extends Schema {
                @type(["number"])
                arrayOfNumbers: ArraySchema<number> = new ArraySchema();
            }

            const state = new MyState();
            state.arrayOfNumbers = new ArraySchema(10, 20, 30, 40, 50, 60, 70);

            const decodedState = new MyState();

            decodedState.arrayOfNumbers.onRemove = function(item, index) {};
            const onRemoveSpy = sinon.spy(decodedState.arrayOfNumbers, 'onRemove');

            decodedState.arrayOfNumbers.onAdd = function(item, index) {};
            const onAddSpy = sinon.spy(decodedState.arrayOfNumbers, 'onAdd');

            decodedState.arrayOfNumbers.onChange = function(item, index) {}
            const onChangeSpy = sinon.spy(decodedState.arrayOfNumbers, 'onChange');

            decodedState.decode(state.encode());

            assert.deepEqual(decodedState.arrayOfNumbers.toArray(), [10, 20, 30, 40, 50, 60, 70]);
            sinon.assert.callCount(onAddSpy, 7);

            // mutate array
            state.arrayOfNumbers[0] = 0;
            state.arrayOfNumbers[3] = 10;
            decodedState.decode(state.encode());

            assert.deepEqual(decodedState.arrayOfNumbers.toArray(), [0, 20, 30, 10, 50, 60, 70]);
            sinon.assert.callCount(onChangeSpy, 2);

            // mutate array
            state.arrayOfNumbers[4] = 40;
            state.arrayOfNumbers[6] = 100;
            decodedState.decode(state.encode());

            assert.deepEqual(decodedState.arrayOfNumbers.toArray(), [0, 20, 30, 10, 40, 60, 100]);
            sinon.assert.callCount(onAddSpy, 7);
            sinon.assert.callCount(onChangeSpy, 4);
            sinon.assert.notCalled(onRemoveSpy);
        });

        it("detecting onRemove on array items", () => {
            const state = new State();
            state.arrayOfPlayers = new ArraySchema(new Player("Jake Badlands"), new Player("Katarina Lyons"));

            let jake: Player;

            const decodedState = new State();
            decodedState.onChange = function (changes: DataChange[]) {
                jake = changes[0].value[0];
                assert.ok(jake instanceof Player);
                assert.equal("Jake Badlands", jake.name);
            };

            let onChangeSpy = sinon.spy(decodedState, 'onChange');
            decodedState.decode(state.encode());
            sinon.assert.calledOnce(onChangeSpy);

            state.arrayOfPlayers.shift();

            decodedState.arrayOfPlayers.onRemove = function (item, index) {
                assert.equal(item.name, jake.name);
            };
            let onArrayItemRemove = sinon.spy(decodedState.arrayOfPlayers, 'onRemove');

            jake.onRemove = function () {}
            const onItemRemoveSpy = sinon.spy(jake, "onRemove");

            decodedState.onChange = function (changes: DataChange[]) {
                assert.equal(changes.length, 1);
            }

            onChangeSpy = sinon.spy(decodedState, 'onChange');
            decodedState.decode(state.encode());
            sinon.assert.calledOnce(onItemRemoveSpy);
            sinon.assert.calledOnce(onArrayItemRemove);
        });

        it("should call onAdd / onChance correctly for 0's", () => {
            class GridState extends Schema {
                @type(["number"]) grid: ArraySchema<number>;
            }

            const state = new GridState();
            state.grid = new ArraySchema(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);

            const decodedState = new GridState();
            decodedState.grid = new ArraySchema<number>();
            decodedState.grid.onAdd = function (item, index) {};
            decodedState.grid.onChange = function (item, index) {};

            const onAddSpy = sinon.spy(decodedState.grid, "onAdd");
            const onChangeSpy = sinon.spy(decodedState.grid, "onChange");

            decodedState.decode(state.encode());

            state.grid[0] = 1;
            decodedState.decode(state.encode());

            state.grid[2] = 1;
            decodedState.decode(state.encode());

            state.grid[5] = 1;
            decodedState.decode(state.encode());

            state.grid[5] = 0;
            decodedState.decode(state.encode());

            sinon.assert.callCount(onAddSpy, 12);
            sinon.assert.callCount(onChangeSpy, 4);
        });

        it("should call onAdd when replacing items", () => {
            const type = Context.create();

            class Card extends Schema {
                @type("number") num: number;
            }

            class Player extends Schema {
                @type([Card]) cards = new ArraySchema<Card>();
            }

            class CardGameState extends Schema {
                @type(Player) player = new Player();
            }

            const state = new CardGameState();
            state.player.cards.push(new Card().assign({ num: 1 }));

            const decodedState = Reflection.decode<CardGameState>(Reflection.encode(state));

            let onAddSpy: sinon.SinonSpy;
            decodedState.player.onChange = function() {
                decodedState.player.cards.onAdd = function (item, i) {};
                onAddSpy = sinon.spy(decodedState.player.cards, "onAdd");
            }

            decodedState.decode(state.encode());
            sinon.assert.callCount(onAddSpy, 1);

            state.player.cards.splice(0, 1);
            state.player.cards.push(new Card().assign({ num: 2 }));
            decodedState.decode(state.encode());
            sinon.assert.callCount(onAddSpy, 2);
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

            decodedState.mapOfPlayers = new MapSchema();

            let callCount: number = 0;
            decodedState.mapOfPlayers.onAdd = function (item: Player, key) {
                if (callCount === 0) {
                    assert.equal("jake", key);
                    assert.equal("Jake Badlands", item.name);

                } else if (callCount === 1) {
                    assert.equal("katarina", key);
                    assert.equal("Katarina Lyons", item.name);

                } else if (callCount === 3) {
                    assert.equal("snake", key);
                    assert.equal("Snake Sanders", item.name);
                }
                callCount++;
            };
            const onAddSpy = sinon.spy(decodedState.mapOfPlayers, 'onAdd');

            const onRemoveSpy = sinon.spy((item, key) => {});
            decodedState.mapOfPlayers.onRemove = onRemoveSpy;

            const onChangeSpy = sinon.spy(decodedState, 'onChange');
            decodedState.decode(state.encode());

            sinon.assert.callCount(onAddSpy, 2);
            sinon.assert.calledOnce(onChangeSpy);

            state.mapOfPlayers['snake'] = new Player("Snake Sanders");

            decodedState.decode(state.encode());
            sinon.assert.callCount(onChangeSpy, 1);
            sinon.assert.callCount(onAddSpy, 3);
            sinon.assert.callCount(onRemoveSpy, 0);
        });

        it("detecting multiple changes on item inside a map", () => {
            const state = new State();
            state.mapOfPlayers = new MapSchema({
                'jake': new Player("Jake Badlands")
            });

            const decodedState = new State();
            decodedState.decode(state.encode());

            decodedState.mapOfPlayers['jake'].onChange = function (changes: DataChange[]) {}
            let onChangeSpy = sinon.spy(decodedState.mapOfPlayers['jake'], 'onChange');

            state.mapOfPlayers['jake'].x = 100;
            let encoded = state.encode();
            decodedState.decode(encoded);

            state.mapOfPlayers['jake'].x = 200;
            encoded = state.encode();
            decodedState.decode(encoded);

            sinon.assert.calledTwice(onChangeSpy);
        });

        it("should call onAdd / onRemove on map", () => {
            const state = new State();
            state.mapOfPlayers = new MapSchema({
                'jake': new Player("Jake Badlands"),
            });

            const decodedState = new State();
            decodedState.decode(state.encode());

            let addCallCount: number = 0;
            decodedState.mapOfPlayers.onAdd = function (player: Player, key: string) {
                if (addCallCount === 0) {
                    assert.equal("snake", key);

                } else if (addCallCount === 1) {
                    assert.equal("katarina", key);
                }
                addCallCount++;
            }
            decodedState.mapOfPlayers.onRemove = function (player: Player, key: string) {
                assert.equal("snake", key);
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
        });

        it("should allow onAdd using primitive types", () => {
            class MapWithPrimitive extends Schema {
                @type({map: "boolean"}) mapOfBool = new MapSchema<boolean>();
            }

            const state = new MapWithPrimitive();
            state.mapOfBool['one'] = true;

            const decodedState = new MapWithPrimitive();
            decodedState.mapOfBool.onAdd = function(value, key) { console.log("ON ADD", value, key); }
            const onAddSpy = sinon.spy(decodedState.mapOfBool, 'onAdd');

            decodedState.decode(state.encodeAll());

            state.mapOfBool['two'] = true;

            console.log("\n\nWILL ENCODE AGAIN!");
            decodedState.decode(state.encode());

            sinon.assert.calledTwice(onAddSpy);
            console.log(decodedState.toJSON());
        });

        it("should not loose reference when add / remove is performed at once", () => {
            const state = new State();
            state.mapOfPlayers = new MapSchema({
                ['food1']: new Player("food 1", 1, 1),
                ['food2']: new Player("food 2", 2, 2),
                ['food3']: new Player("food 3", 3, 3),
                ['food4']: new Player("food 4", 4, 4),
                ['food5']: new Player("food 5", 5, 5),
                ['food6']: new Player("food 6", 6, 6),
                ['food7']: new Player("food 7", 7, 7),
                ['food8']: new Player("food 8", 8, 8),
                ['food9']: new Player("food 9", 9, 9),
                'player': new Player("Player", 10, 10)
            });

            const decodedState = new State();
            decodedState.decode(state.encode());

            /* CHANGESET */
            let keyAddition = 'food10';
            let keyRemoval = 'food2';
            decodedState.mapOfPlayers.onAdd = (player: Player, key: string) => { assert.equal(key, keyAddition); }
            decodedState.mapOfPlayers.onRemove = (player: Player, key: string) => { assert.equal(key, keyRemoval); }
            decodedState.mapOfPlayers.onChange = (player: Player, key: string) => { assert.equal(key, 'player'); }

            const unchangedSpies = ['food1', 'food2', 'food3', 'food4', 'food5', 'food6', 'food7', 'food8', 'food9'].map((key) => {
                decodedState.mapOfPlayers[key].onChange = function () {};
                return sinon.spy(decodedState.mapOfPlayers[key], 'onChange');
            });

            // move "player", delete one food, insert another.
            state.mapOfPlayers['player'].x += 1;
            state.mapOfPlayers['player'].y += 1;
            state.mapOfPlayers[keyAddition] = new Player("food 10", 10, 10);
            delete state.mapOfPlayers[keyRemoval];

            decodedState.decode(state.encode());

            assert.equal(decodedState.mapOfPlayers['food1'].x, 1);
            assert.equal(decodedState.mapOfPlayers['food2'], undefined);
            assert.equal(decodedState.mapOfPlayers['food3'].x, 3);
            assert.equal(decodedState.mapOfPlayers['food4'].x, 4);
            assert.equal(decodedState.mapOfPlayers['food5'].x, 5);
            assert.equal(decodedState.mapOfPlayers['food6'].x, 6);
            assert.equal(decodedState.mapOfPlayers['food7'].x, 7);
            assert.equal(decodedState.mapOfPlayers['food8'].x, 8);
            assert.equal(decodedState.mapOfPlayers['food9'].x, 9);
            assert.equal(decodedState.mapOfPlayers['food10'].x, 10);
            assert.equal(decodedState.mapOfPlayers['player'].x, 11);

            /*
             * CHANGESET
             */
            state.mapOfPlayers['player'].x += 1;
            state.mapOfPlayers['player'].y += 1;
            decodedState.decode(state.encode());

            assert.equal(decodedState.mapOfPlayers['food1'].x, 1);
            assert.equal(decodedState.mapOfPlayers['food2'], undefined);
            assert.equal(decodedState.mapOfPlayers['food3'].x, 3);
            assert.equal(decodedState.mapOfPlayers['food4'].x, 4);
            assert.equal(decodedState.mapOfPlayers['food5'].x, 5);
            assert.equal(decodedState.mapOfPlayers['food6'].x, 6);
            assert.equal(decodedState.mapOfPlayers['food7'].x, 7);
            assert.equal(decodedState.mapOfPlayers['food8'].x, 8);
            assert.equal(decodedState.mapOfPlayers['food9'].x, 9);
            assert.equal(decodedState.mapOfPlayers['food10'].x, 10);
            assert.equal(decodedState.mapOfPlayers['player'].x, 12);

            /*
             * CHANGESET
             */
            keyAddition = 'food11';
            keyRemoval = 'food5';

            // move "player", delete one food, insert another.
            state.mapOfPlayers['player'].x += 1;
            state.mapOfPlayers['player'].y += 1;
            state.mapOfPlayers[keyAddition] = new Player("food 11", 11, 11);
            delete state.mapOfPlayers[keyRemoval];

            decodedState.decode(state.encode());

            assert.equal(decodedState.mapOfPlayers['food1'].x, 1);
            assert.equal(decodedState.mapOfPlayers['food2'], undefined);
            assert.equal(decodedState.mapOfPlayers['food3'].x, 3);
            assert.equal(decodedState.mapOfPlayers['food4'].x, 4);
            assert.equal(decodedState.mapOfPlayers['food5'], undefined);
            assert.equal(decodedState.mapOfPlayers['food6'].x, 6);
            assert.equal(decodedState.mapOfPlayers['food7'].x, 7);
            assert.equal(decodedState.mapOfPlayers['food8'].x, 8);
            assert.equal(decodedState.mapOfPlayers['food9'].x, 9);
            assert.equal(decodedState.mapOfPlayers['food10'].x, 10);
            assert.equal(decodedState.mapOfPlayers['food11'].x, 11);
            assert.equal(decodedState.mapOfPlayers['player'].x, 13);

            /*
             * CHANGESET
             */

            state.mapOfPlayers['player'].x += 1;
            state.mapOfPlayers['player'].y += 1;

            decodedState.decode(state.encode());

            assert.equal(decodedState.mapOfPlayers['food1'].x, 1);
            assert.equal(decodedState.mapOfPlayers['food2'], undefined);
            assert.equal(decodedState.mapOfPlayers['food3'].x, 3);
            assert.equal(decodedState.mapOfPlayers['food4'].x, 4);
            assert.equal(decodedState.mapOfPlayers['food5'], undefined);
            assert.equal(decodedState.mapOfPlayers['food6'].x, 6);
            assert.equal(decodedState.mapOfPlayers['food7'].x, 7);
            assert.equal(decodedState.mapOfPlayers['food8'].x, 8);
            assert.equal(decodedState.mapOfPlayers['food9'].x, 9);
            assert.equal(decodedState.mapOfPlayers['food10'].x, 10);
            assert.equal(decodedState.mapOfPlayers['food11'].x, 11);
            assert.equal(decodedState.mapOfPlayers['player'].x, 14);

            /*
             * ADDS SECOND DECODER
             */
            const secondDecodedState = new State();
            secondDecodedState.decode(state.encodeAll());

            console.log("decodedState =>", decodedState.toJSON());
            console.log("secondDecodedState =>", secondDecodedState.toJSON());

            assert.equal(JSON.stringify(secondDecodedState), JSON.stringify(decodedState));

            // "food"'s onChange should NOT be called.
            unchangedSpies.forEach((onChangedSpy) => sinon.assert.notCalled(onChangedSpy));
        });

        it("should call onAdd 5 times", () => {
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
            for (let i = 0; i < 5; i++) {
                state.mapOfPlayers[i] = new Player("Player " + i, Math.random() * 2000, Math.random() * 2000);
            }

            let encoded = state.encode();
            decodedState.decode(encoded);

            assert.equal(decodedState.mapOfPlayers.size, 5);
            sinon.assert.callCount(onAddSpy, 5);
        });

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
            sinon.assert.notCalled(onChangeSpy);
            sinon.assert.calledOnce(onItemRemoveSpy);
        });
    });

    describe("complex structures", () => {
        it("should identify changes on arrays inside maps", () => {
            class Block extends Schema {
                @type("number") x: number;
                @type("number") y: number;
            }
            class Player extends Schema {
                @type([Block]) blocks = new ArraySchema<Block>();
                @type("string") name: string;
            }
            class MyState extends Schema {
                @type({ map: Player })
                players = new MapSchema<Player>();
            }

            const state = new MyState();
            state.players['one'] = new Player().assign({ name: "Jake" });
            state.players['one'].blocks.push(new Block().assign({ x: 10, y: 10 }));

            const decodedState = new MyState();
            decodedState.decode(state.encodeAll());

            decodedState.players['one'].blocks.onAdd = function (block, key) {}
            const onBlockAddSpy = sinon.spy(decodedState.players['one'].blocks, 'onAdd');

            decodedState.players['one'].blocks.onChange = function (block, key) {}
            const onBlockChangeSpy = sinon.spy(decodedState.players['one'].blocks, 'onChange');

            state.players['one'].blocks[0].x = 100;
            state.players['one'].blocks.push(new Block().assign({ x: 50, y: 150 }));
            decodedState.decode(state.encode());

            assert.equal(decodedState.players['one'].blocks[0].x, 100);
            assert.equal(decodedState.players['one'].blocks[1].x, 50);
            assert.equal(decodedState.players['one'].blocks[1].y, 150);

            sinon.assert.calledOnce(onBlockAddSpy);
            // sinon.assert.calledOnce(onBlockChangeSpy);
        });

        it("should identify reference inside a reference", () => {
            class Vector3 extends Schema {
                @type("number") x: number;
                @type("number") y: number;
                @type("number") z?: number;
                constructor(x: number = 0, y: number = 0, z?: number) {
                    super();
                    this.x = x;
                    this.y = y;
                    this.z = z;
                }
            }
            class Player extends Schema {
                @type(Vector3) position: Vector3 = new Vector3();
            }
            class MyState extends Schema {
                @type({ map: Player }) players = new MapSchema<Player>();
            }

            const state = new MyState();
            const decodedState = new MyState();
            decodedState.decode(state.encodeAll());

            state.players['one'] = new Player();
            decodedState.decode(state.encode());

            state.players['one'].position.x += 0.01;
            decodedState.decode(state.encode());
            assert.equal(JSON.stringify(decodedState), '{"players":{"one":{"position":{"x":0.01,"y":0}}}}');
        });
    });

    describe("with filters", () => {
        class Round extends Schema {
            @type(["number"]) scores = new ArraySchema<number>(0, 0);
            @type(["number"]) totals = new ArraySchema<number>(0, 0);
        }

        class State extends Schema {
            @filter(() => true)
            @type("number") timer: number;

            @type(Round) currentRound: Round = new Round();
        }

        it("should not trigger unchanged fields", () => {
            let totalFieldChanges: number = 0;
            let scoresFieldChanges: number = 0;

            const state = new State();
            state.timer = 10;

            const decodedState = new State();

            // decodedState.currentRound.listen("scores", () => scoresFieldChanges++);
            // decodedState.currentRound.listen("totals", () => totalFieldChanges++);

            decodedState.listen("currentRound", (currentRound) => {
                currentRound.scores.onChange = function (value, key) {
                    scoresFieldChanges++;
                };

                currentRound.totals.onChange = function (value, key) {
                    totalFieldChanges++;
                };
            });

            do {
                state.timer--;

                state.currentRound.scores[0]++;
                state.currentRound.scores[1]++;

                const encoded = state.encode(undefined, undefined, true);
                decodedState.decode(state.applyFilters(encoded, {}));

                state.discardAllChanges();
            } while (state.timer > 0);

            // set 'totals' field once.
            state.currentRound.totals[0] = 100;
            state.currentRound.totals[1] = 100;

            const encoded = state.encode(undefined, undefined, true);
            decodedState.decode(state.applyFilters(encoded, {}));
            state.discardAllChanges();

            assert.equal(2, totalFieldChanges);
            assert.equal(20, scoresFieldChanges);
            // assert.equal(10, scoresFieldChanges);
        });
    });

    describe("triggerAll", () => {
        it("should trigger onChange on Schema instance", () => {
            const state = new State();
            state.mapOfPlayers = new MapSchema<Player>();
            state.mapOfPlayers['one'] = new Player("Endel", 100, undefined);

            const decodedState = new State();
            decodedState.mapOfPlayers = new MapSchema<Player>();
            decodedState.decode(state.encode());

            const player = decodedState.mapOfPlayers.get("one");
            player.onChange = function(changes) {
                assert.equal(2, changes.length);
            };
            const onChangeSpy = sinon.spy(player, 'onChange');
            player.triggerAll();

            sinon.assert.calledOnce(onChangeSpy);
        });
    })

    describe("encodeAll", () => {
        it("shouldn't trigger onRemove for previously removed items", () => {
            const state = new State();
            state.mapOfPlayers = new MapSchema<Player>({
                'player': new Player("Player One", 0, 0)
            });
            state.encode();

            delete state.mapOfPlayers['player'];
            state.encode();

            const decodedState = new State();
            decodedState.mapOfPlayers = new MapSchema<Player>();
            decodedState.mapOfPlayers.onRemove = function() {}
            const onRemoveSpy = sinon.spy(decodedState.mapOfPlayers, 'onRemove');

            decodedState.decode(state.encodeAll());

            sinon.assert.notCalled(onRemoveSpy);
        });
    });

    describe("callback order", () => {
        class MyState extends Schema {
            @type("string") str: string;
            @type("number") num: number;
            @type(["number"]) arrOfNumbers = new ArraySchema<number>();
            @type([Player]) arrOfPlayers = new ArraySchema<Player>();
            @type({ map: Player }) mapOfPlayers = new MapSchema<Player>();
        }

        it("previous fields should be available during later field's callbacks", () => {
            const state = new MyState();

            state.str = "Hello world";
            state.num = 10;

            state.arrOfNumbers.push(10);
            state.arrOfNumbers.push(20);

            state.arrOfPlayers.push(new Player("Jake", 0, 0));
            state.arrOfPlayers.push(new Player("Snake", 10, 10));

            state.mapOfPlayers['katarina'] = new Player("Katarina", 20, 20);

            const decodedState = new MyState();

            let strs: string[] = [];
            let nums: number[] = [];
            let mapOfPlayersDuringArrOfPlayers: number[] = [];

            decodedState.arrOfPlayers.onAdd = function(item, index) {
                strs.push(decodedState.str);
                nums.push(decodedState.num);
                mapOfPlayersDuringArrOfPlayers.push(Object.keys(decodedState.mapOfPlayers).length);
            }

            const encoded = state.encode();

            // console.log(util.inspect(encoded, true, 4));
            decodedState.decode(encoded);

            assert.deepEqual(strs, ["Hello world", "Hello world"]);
            assert.deepEqual(nums, [10, 10]);
        });

    });

    describe("propagante change to parent structure", () => {
        xit("Array -> Schema should trigger onChange on Array", () => {
            class Item extends Schema {
                @type("number") qty: number = 1;
            }
            class State extends Schema {
                @type([Item]) items: ArraySchema<Item>;
            }

            const state = new State();
            state.items = new ArraySchema();
            state.items.push(new Item().assign({ qty: 1 }));
            state.items.push(new Item().assign({ qty: 1 }));
            state.items.push(new Item().assign({ qty: 1 }));

            const decodedState = new State();
            decodedState.decode(state.encode());
            decodedState.items.onChange = function (item, key) {}
            const onChangeSpy = sinon.spy(decodedState.items, 'onChange');

            state.items[0].qty++;
            state.items[1].qty++;
            state.items[2].qty++;

            decodedState.decode(state.encode());

            //
            // This is not supported anymore since colyseus/schema@1.0.0
            //
            sinon.assert.callCount(onChangeSpy, 3);
        });

    });

    describe(".listen()", () => {
        it("TypeScript should recognize boolean properties", () => {
            class State extends Schema {
                @type("boolean")
                bool: boolean;
            }

            const state = new State();
            state.listen("bool", () => {});

            assert.ok(true, "This piece of code should compile.");
        });
    });

});