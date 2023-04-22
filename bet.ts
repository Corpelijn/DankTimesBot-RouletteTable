import { User } from "../../src/chat/user/user";
import { BetInfo } from "./betInfo";

export class Bet {
    constructor(public user: User, public amount: number, public betInfo: BetInfo) {

    }
}