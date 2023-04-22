import { AlterUserScoreArgs } from "../../src/chat/alter-user-score-args";
import { Chat } from "../../src/chat/chat";
import { User } from "../../src/chat/user/user";
import { Bet } from "./bet";
import { BetInfo } from "./betInfo";
import { Plugin } from "./plugin";


export class Game {
    public isActive: boolean = true;
    private _bets = new Array<Bet>();

    private static readonly ROULETTE_WHEEL = [0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1, 100, 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2];

    constructor(public _chat: Chat, public _plugin: Plugin) {

    }

    public addBet(user: User, amount: number, bet: BetInfo): string {
        let message = ``;
        if (this._bets.length === 0) {
            let gameDuration = +this._chat.getSetting(Plugin.SETTING_DURATION_GAME);
            message = `📢 @${user.name} is starting a new game of Roulette, ending in ${gameDuration} seconds...\n` +
                `Place a bet within ${gameDuration} seconds to participate.\n\n`;
            setTimeout(this.endGame, gameDuration * 1000, this);
        }

        message += `@${user.name} bet ${amount} points on ${bet.getNumbers()} with odds of <code>1:${bet.multiplier}</code>`;

        this._bets.push(new Bet(user, amount, bet));
        this._chat.alterUserScore(new AlterUserScoreArgs(user, -amount, this._plugin.name, `roulette.createbet`));
        this._plugin.statistics.casinoBalance += amount;

        return message;
    }

    private endGame(game: Game) {
        game.isActive = false;

        let winNumber = Game.ROULETTE_WHEEL[Math.floor(Math.random() * Game.ROULETTE_WHEEL.length)];
        let color = BetInfo.knownBets.get('red').numbers.indexOf(winNumber) !== -1 ? `🟥` : `⬛️`;
        if (winNumber === 0 || winNumber === 100) {
            color = `🟩`;
        }
        let message = `The winning number is <code>${winNumber.toString().replace("100", "00")}</code> ${color}\n`;

        let winningBets = game._bets.filter(b => b.betInfo.numbers.indexOf(winNumber) !== -1);
        if (winningBets.length > 0) {
            let winnerPrices = new Map<User, number>();
            winningBets.forEach(bet => {
                let price = bet.amount * bet.betInfo.multiplier;
                if (winnerPrices.has(bet.user)) {
                    winnerPrices.set(bet.user, winnerPrices.get(bet.user) + price);
                } else {
                    winnerPrices.set(bet.user, price);
                }
            });

            winnerPrices.forEach((price, winner) => {
                message += `@${winner.name} wins ${price}\n`;
                game._chat.alterUserScore(new AlterUserScoreArgs(winner, price, game._plugin.name, `roulette.winbet`));
                game._plugin.statistics.casinoBalance -= price;
            })
        } else {
            message += `<i>There are no winners.</i>`;
        }

        game._plugin.sendTextMessage(game._chat.id, message);
    }
}