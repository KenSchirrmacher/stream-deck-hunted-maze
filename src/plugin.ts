import streamDeck from "@elgato/streamdeck";
import { CellAction } from "./actions/cell.js";
import { StatusAction } from "./actions/status.js";
import { MoveUpAction } from "./actions/move-up.js";
import { MoveDownAction } from "./actions/move-down.js";
import { MoveLeftAction } from "./actions/move-left.js";
import { MoveRightAction } from "./actions/move-right.js";

streamDeck.logger.setLevel("info");

streamDeck.actions.registerAction(new CellAction());
streamDeck.actions.registerAction(new StatusAction());
streamDeck.actions.registerAction(new MoveUpAction());
streamDeck.actions.registerAction(new MoveDownAction());
streamDeck.actions.registerAction(new MoveLeftAction());
streamDeck.actions.registerAction(new MoveRightAction());

streamDeck.connect();
