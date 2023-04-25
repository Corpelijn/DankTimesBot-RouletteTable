import { BotCommand } from "../../src/bot-commands/bot-command";
import { ChatSettingTemplate } from "../../src/chat/settings/chat-setting-template";
import { User } from "../../src/chat/user/user";
import { AbstractPlugin } from "../../src/plugin-host/plugin/plugin";
import { Util } from "../../src/util/util";
import { Game } from "./game";
import { BetInfo } from "./betInfo";
import { Chat } from "../../src/chat/chat";
import TelegramBot from "node-telegram-bot-api";
import { PluginEvent } from "../../src/plugin-host/plugin-events/plugin-event-types";
import { Statistics } from "./statistics";

export class Plugin extends AbstractPlugin {
    // Commands
    public static readonly BET_CMD = ["rbet"];
    public static readonly BETS_CMD = ["rbets"];
    public static readonly INFO_CMD = ["roulette", "rinfo"];
    public static readonly STATS_CMD = ["rstatistics", "rstat"];

    // Settings
    public static readonly SETTING_DURATION_GAME = 'roulette.gameduration';
    public static readonly FILE_STORAGE = "roulette.json";

    private _activeGames = new Map<number, Game>();
    private _util = new Util();
    public statistics = new Statistics();

    constructor() {
        super("Roulette Table Plugin", "1.0.1")

        this.subscribeToPluginEvent(PluginEvent.BotStartup, this.LOAD.bind(this));
        this.subscribeToPluginEvent(PluginEvent.BotShutdown, this.SAVE.bind(this));
        BetInfo.init();
    }

    /**
     * @override
     */
    public getPluginSpecificChatSettings(): Array<ChatSettingTemplate<any>> {
        return [
            new ChatSettingTemplate(Plugin.SETTING_DURATION_GAME, "the seconds before the winning number chosen", 15, (original) => Number(original), this.validateSetting.bind(this)),
        ];
    }

    /**
     * @override
     */
    public getPluginSpecificCommands(): BotCommand[] {
        return [
            new BotCommand(Plugin.INFO_CMD, "prints information about the roulette table", this.HELP.bind(this), true),
            new BotCommand(Plugin.BET_CMD, "creates a new bet", this.BET.bind(this), true),
            new BotCommand(Plugin.BETS_CMD, "shows the bets you can make", this.BETS.bind(this), true),
            new BotCommand(Plugin.STATS_CMD, "shows the statistics of the plugin", this.STATS.bind(this), true),

            // new BotCommand(['give'], '', this._give.bind(this), false),
        ];
    }

    /** FOR DEBUGGING ONLY */
    // private _give(chat: Chat, user: User) {
    //     chat.alterUserScore(new AlterUserScoreArgs(user, 1000, 'test', ''));
    //     return ``;
    // }

    public async sendTextMessage(chatId: number, message: string): Promise<void> {
        await this.telegramBotClient.sendMessage(chatId, message, { parse_mode: "HTML" });
    }

    public async sendPhotoMessage(chatId: number, photo: Buffer): Promise<void> {
        const fileOptions = {
            filename: 'roulette',
            contentType: 'image/x-png',
        };
        await this.telegramBotClient.sendPhoto(chatId, photo, {}, fileOptions);
    }

    private HELP(): any {
        return `♠️♥️ Welcome to Roulette ♣️♦️\n\n` +

            `/${Plugin.BET_CMD[0]} to place a bet\n` +
            `/${Plugin.BETS_CMD[0]} to show the possible bets and table layout\n` +
            `/${Plugin.STATS_CMD[0]} to show the casino balance`;
    }

    private BET(chat: Chat, user: User, msg: TelegramBot.Message, match: string): any {
        let params = match.split(' ').filter(i => i);

        if (params.length !== 2) {
            return `⚠️ Incorrect format. Use: <code>/rbet [amount] [bet_placement]</code>`;
        }

        let amount = this._util.parseScoreInput(params[0], user.score);
        if (amount === null || amount <= 0) {
            return `⚠️ <code>amount</code> must be a whole, positive number`;
        }
        if (user.score < amount) {
            return `⚠️ You don't have enough points to make that bet!`;
        }
        let bet = BetInfo.knownBets.get(params[1].toLowerCase());
        if (bet === undefined) {
            return `⚠️ <code>bet_placement</code> is unknown. See /${"rbets"} for possible bets`;
        }

        let activeGame = this.getActiveGame(chat);
        return activeGame.addBet(user, amount, bet);
    }

    private async BETS(chat: Chat, user: User, msg: TelegramBot.Message, match: string): Promise<string> {
        // Write the example image to the data folder.
        let buff = Buffer.from(Plugin.IMAGE_CONTENT, 'base64');

        // Send the image file to the chat
        await this.sendPhotoMessage(chat.id, buff);
        await this.sendTextMessage(chat.id,
            `The following bets can be made:\n\n` +
            `<b>Straight Up</b>  <code>1:36</code>\nBet on a single number.\nExamples: <code>10</code>\n\n` +
            `<b>Split</b>  <code>1:18</code>\nBet on two numbers next to each other, horizontal or vertical.\nExamples: <code>5|6</code> or <code>5_8</code> or <code>10-11</code>\n\n` +
            `<b>Street</b>  <code>1:12</code>\nBet on three numbers in a single row.\nExamples: <code>|10</code> or <code>15|</code> or <code>4-6</code>\n\n` +
            `<b>Trio</b>  <code>1:12</code>\nBet on three numbers including 0 and/or 00.\nExamples: <code>0-1-2</code> or <code>00-2-3</code> or <code>0-00-2</code>\n\n` +
            `<b>Corner</b>  <code>1:9</code>\nBet on four neighbouring numbers.\nExamples: <code>14+18</code> or <code>7-11</code>\n\n` +
            `<b>Basket</b>  <code>1:7</code>\nBet on 0-00-1-2-3.\nExamples: <code>0-00-1-2-3</code> or <code>BASKET</code>\n\n` +
            `<b>Sixline</b>  <code>1:6</code>\nBet on two adjacent rows.\nExamples: <code>4-9</code>\n\n` +
            `<b>Column</b>  <code>1:3</code>\nBet on a vertical column (12 numbers, except 0 and 00).\nExamples: <code>COL1</code> or <code>1-34</code>\n\n` +
            `<b>Dozens</b>  <code>1:3</code>\nBet on one of the three dozens.\nExamples: <code>1D</code> or <code>13-24</code>\n\n` +
            `<b>Snake</b>  <code>1:3</code>\nBet on the snake (connected red numbers from 1 zigzagging to 34).\nExamples: <code>SNAKE</code>\n\n` +
            `<b>Odd/Even</b>  <code>1:2</code>\nBet on all odd or even numbers (except 0 and 00).\nExamples: <code>ODD</code> or <code>EVEN</code>\n\n` +
            `<b>Red/Black</b>  <code>1:2</code>\nBet on all red or black numbers.\nExamples: <code>RED</code> or <code>BLACK</code>\n\n` +
            `<b>Low/High</b>  <code>1:2</code>\nBet on one half of the numbers (except 0 and 00).\nExamples: <code>1-18</code> or <code>19-36</code> or <code>LOW</code> or <code>HIGH</code>`);
        return '';
    }

    private STATS():any {
        return `♠️♥️ Casino Roulette Balance ♣️♦️\n${this.statistics.casinoBalance}`;
    }

    private SAVE(): any {
        this.saveDataToFile(Plugin.FILE_STORAGE, this.statistics.toJSON());
    }

    private LOAD(): any {
        let obj = this.loadDataFromFile(Plugin.FILE_STORAGE);
        if (obj !== null) {
            this.statistics = Statistics.fromJSON(obj);
        }
    }

    private getActiveGame(chat: Chat) {
        let game: Game;
        // Check if the chatId is already in the active games list
        if (this._activeGames.has(chat.id)) {
            game = this._activeGames.get(chat.id);

            // If the game is still active, use that game; otherwise create a new game.
            if (!game.isActive) {
                game = new Game(chat, this);
                this._activeGames.set(chat.id, game);
            }
        } else {
            // If there never was a game create a new game and set it to the active games list
            game = new Game(chat, this);
            this._activeGames.set(chat.id, game);
        }

        return game;
    }

    private validateSetting(value: number) {
        if (Math.round(value) !== value || value <= 0) {
            throw new Error(`Value must be a whole, positive number`);
        }
    }

    private static readonly IMAGE_CONTENT = `iVBORw0KGgoAAAANSUhEUgAAAOsAAAJcCAMAAAAvhKMDAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAMAUExURQAAAAEBAQAAOjoAADsBAToAOgAAZjpmZmYAAGcBAQA6jwA6kABmtQBmtgCwUAGwUQCwcDqwUGawUGa9UACwjwC9jwC9rDqP2jqQ2wDLyDrY4zrY5Ga1/ma2/2bl/mbl/5A6AJA7AbZmALZnAbZmOrZnO/8AAP8BAf8AOv86AP87Af8AZv9mAP9nAf9mOv86j/86kP9mtf9mtpC9UJC9UbbLULbLUduQOtuQO/+QOv+QO/+2Zv62Z9vYcNvYcZCQtpC2/7bbkLbYrJDYyI/a/pDa/pDb/4/yyJDyyI/y/pDy/7X/5LX+/rX//9u2tv+2kP+P2v+Q2/+1/v+2/9ryrP/bkP7lj/7yrP//ttvb29vb/9vlyNr/yNv/29v/5Nvy/9r+///b2//a/v/b//7/yP7+2/7/5P7+/v7+/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHwXCJYAAAAJcEhZcwAADsMAAA7DAcdvqGQAAB1PSURBVHhe7Z0Nexy3cYBdNmET02TpmqYpUpTculXoMnEo1ao/049UZSNarC2xtNXUcc9iad3//wXFDAa7GGDwsXd7t7c4vM9j39HG4fY9YLHYxezsGzvrQ3Utk+paJtW1TKprmVTXMqmuPTIdFtoKZPGu9DojfX68uvZIdc2mumZTXRdFdc2mumZTXRdFdc2mumZTXRdFdGP3LtVp12P6QyT08faT+O4f8T/6rI7r/uR3OztHUdnAx+mTSjFex+q43v/u7Z2d3Qv4d4jAx9tP6ndPA3WsjOvepWoS1Sg//QP+KSJ/vP0kvTsM1LEyrvsT7Hl3Yp1Y/nj7yUQdK+NKGziDa/vJRB3VdVFEXNepD+PhYqaxqf0kvVv5sUkfbWY55rSfpHcrf8xRPU81SrRZQx+nT36cqmN1XNWGTqdR1eDH20/iOyUtskKuafr8eHXtkeqaTXXNprouiuqaTXXNprouiuqaTXXNJuyqzhhKg8wQ7kqvaTqUfJDL9I1cXtMn0lRXoLpKVFeJ6ipRXSWqq0R1BaqrRHWVqK4Sw7nuXdKK5v4PwoJLoa460sRhPteTm+lv6K2F77pxrs7KvqA/LHxXVeN0+pL+sOjqSqEmjLlcH6ntynI9Vp7bgqzv+uKzBw9OBdlcVzjV1fzfX9F/bJjH9Wz62aM8V+T45S/pXUOgDz+//ZDeNXR39TvxPK6KLq4Hy3CVoy00S3TNbtdHU9WRHcblujX5hN61BMYmXzXTdfcP3k5qsTTXjfOXv6C3LXK7nk5n7cNxluZ6fPs+vbMI7K+n0y/oXcOYXA+mf0PvbAKuJzfX9K5hRK4HU39nVZTYrtuyqu96+vrX0Kyrt7+e6YO239/IpAGniIov6e8Gv10fQjmvxpVoVxFxbBIJ9GGBbq6HYqRfYa77E+xACiGKrizX3Qsylab+hbmaOeI69OHdC33Wuhb7a5TSXHFwEvZVoDBXiEFWyKHMZblSGP7u02/135yyXM04fEfsxdVVYhT7q74sHLgbpDBXM0cULzt1cB0W2gok7KpniYG7QTq4Ulukye8Br+kTaXJdY9glmyuO8soPfWuaUbnKKz/0rWnG5Squ/NC3phmHqx4GAGHlh741zdhc/U5cah+WGINrYnSlV6Ag1+S6+u5/yOd9mnG5zrmuTt+aZkhXGm4UwuhKr2nG5iqMrvSaZlx9WILVcajaXU2exZO/wlx3n8Ld8ar55SsY9K1phnPNX1eHX0X1+P+ZyGf19K2MjXMhksd3heCg6fTlr+jPBsl1C05BvWW9PNc4rivk7dj/Ptv14PaPWa7+IiMiuMqL0r277txTv6gavvb/S7yCQd9qs3n5t//er+ubQgQJkOt6fwppKg7F/ZCVVOMSXFm9n72/Hl//vGfX94QIEiDTFUab6e/wKnHeXOJImF+Jrlt/en/jSa+uG0+u/5zecvJccT1HmarGEiRYHfHVS/rWlo3zL9TGZY9Ngq/g+jWswfvCea76mHMfU67E5027T2GTEGEk9l23VX/Lc0Wu/NgKz3XzGYQGbV56sh1cdy9g6xOu5kic2Yc3L9Uw0sH1dPolvWsQ2hWrO/CCofJcdR/+6X/TfRjnEopM123qA95BIuAqRC2F9tdZXfXY9C3ui3ljk4wwNil6blcah4+90TjTFWRVoypZob2W4npyg1FLOfOmNyeqPiEcKtc1xlJc9TgsRC35rnqK6E+dVsFVItCHBQTXANUVqK4Sdsl1vRZevmtzBUOaYdG3pqmuEsO5mjmi4mhJrn9GH0nSt+vOPTOx2r3wT9cLc92fkOx9IbiiMFd9mgD4JwnFucIVJ4W/syqKc42wsq750CfSUPmhoK1AemnXaPQttUWa/B7w2jujDdG7q4m+FcO+ynKlkEXp4Kooy9XMEQMRqfStaaqrxID7q54jBvK5F+Zq1jjEh9gU5qqnTfJNEMW5xqiuEmNw3bvUA3BgPYe+Nc04XPXJ3Hq4Pj6CkWlNXKFtv10XVzwByHM91QdjIT8CmVjgWq0f4SK4wjKXEG2wGNeO86bf+tlbfNdtWHnbnn5Kfzb4rt9Mf/3gwZUv27drnIDrCyGvFJm0HMNq+ca5n3PBdT19Db1kNXNp0MZxBFdYJ9+8TLueYS9ZSo6U7tclhLRSguvW5OUvNs6F/E2y64Mrr7P07tr9uoTQApIrrpb7C/C+68kr+O3O/IRrea6J1Td6BeB24N2Lx+J9AQHX/Nw3P06m1z+jvxr8sQlzVV3P2q75rjAOg2sgzpS+1UaK95BcMXnTth+O5rtqrmbcX+moCZrS6hu9AsY1/7oE7V4OniulH/OjlgKuM4/D+a6wTqdcO1xbEw6Eirld58yjl+MK6TbgbF1sVslV+P0Bz3XjHCy3JuljDvJc6C1dXJGUK/DuO/TGRXB9DpMcH2FsOobRImeO+EKVkzpLnmucDiXpW9MIrgFCY5NP367NiC124nG57gs3aNglTfywODSNyRUbzZ8kiCX/id4xxuKK10LlnkmvNmM+V78fElVIrsJwrRiDq+q8gavbgOQqBPwoynJt7m0Y8f4KZ6UhXedXQUY+DsOZqajrlQwyGlfFodKNH1/jjMlVcX+NXAWqqwQOW8NBW4EEXZsZvWKuPkxtkWa4dl0v1+zrElGqq0R1lViMK1K8a5zqKlFdJYZzXafjq75dQbM2Y5OSzrqOGGBErtCVpbtu6DXNaFwDpgW6gmkzoeDM7LpxTnfQb8LYx26md0s+Mf+7+YzBcTWPu8PFdb4EmOkKl9YCprO7vmUEMQkRT7rES0IYl/6/7TsDd20ed3elPB9y2TxX+5jT29i0NfkE47PeeOOuDl2ywwPckm/pkluTT+kzDczVedwdj5no7trnMUdv9+Yzf8ncLUmuiqirwnZ9PoNrnHldtya49UyiH9dZ2jXOvK609f27OnGOJbuevOIhTqvguqg+7EbYrIbrQsam59aOi6yCq04uFTnmKLq7+lE/q+CqRGAuwaK05nYVHhQ6oCtmWdL57mA2xAPSAiWtzxiYa/O4O5wiKuyJ04CuUfJLuu0aproC1VWiukpUV4nqKlFdJaorUF0lqqtEdZVYsmt5kBnCXenXSLOQdqW60/SSl4vqSlNdJaqrRHWVqK4S1RWorhLVVaK6SlRXieoqUV2BJbiaWCX1Op3yR8A4337yqrmF/+SGR/I4rqquD+BVP5mHVTqkaxPfdPcTCOfi20V1ayBqybg+v72JuIKiduXrfsCArm18E+Ksv1LdyNn0s4fG9XT6UcQV61xBV0Wmq6JxfXF9EmtXqHPlXZ3nGIVcz24/HLcrjk1MNeR6cvOl+ifLVVXprtXTViBDtuvmZU4ffvTyV5muyLG1j6yQq5K1k27JrqcQ8NHB1amTtgIZ1NWJ+aG6DdoVn+8F6J0Xibk6ddJWICvfrsio23Xzmfq3zs/UMK/rxjnWOcO8yaTiBLyUbbO6trFKMIFyEqkx1yZqCYm5tnXiOOzUSVuBBF1NZBTQm2uU/F7ltmuYPFcNhNCrUV//YVGgq+47a+Gq+jEkMvTTDhbnCsPDR7jXJvLTRRmDK4zDqgOrM2bn9h6kMFcxX6OhLNc41VViLPurofRjznq54hkVHF+Ln0vku+5dmvso7wj5ykpzNTeNis/OHBbaCiThiiRdf28enik9E5U+kSa/B/QSt0Yl0nDXx6YbS5lj6BNpRuKq/sFdVUgFX56rSb3hJy0Yg2v+8ZWyH0HeSCH1ZZGuAcbhmjsOx6muEsO5ntw0VyN4GgPErqPJzuAfcBRjcG2vMjkXZxG7jpHmRqcSyJm5EH3V9uYGVodmbLnRqYTmuW4u6dKa5Dq23OhUgtCX/v2dVSG5ChNExUhcI4jtugaunXKjq75Cez+uTtm7h+NK+Zswz5PCXml0XFWdOucCrtWyPa5vV3PMyRmHH6py2tV/2Ap3hUW3dqWWcm8Q3LXJ3/QIquSJF/p2jcPqxFxL6Jh6Fl+bvwnBp7c1MNc2fxMeJfkRckBXBbl+I8xPyMRgufLFcm9/Na5QJ38QUf+uXZ5Pp11PXgnrYWRisFx50FfIFZ7ZdnLDfsTeXen5dHnPpjauX8MBjQmHXXm8R9AVhzs+x+vbFZ5PBy95z87UrqevYbnolMmGXe14EiDk+nz6o/v70VYgPbia89e8uYRpV/z92ZPHgq5OvEd4f4XaHvHfj7YC6aVdZ3HFLcpzxfyCNrIrPfWO10lbgfSxvx6iZObcX7vSOMwSwQVd77oxlQO64lOFCG9CEXD9LQwiznGfTAzGdfMZO+AoZNeTG7A8W+gxx86k6KeNZHVaUUv4FrUNzNXK2sSzYwLM1arzCt6wOUr/7RqjQ51kksZt1zDVFaiuEtVVorpKVFeJ4VwTmYrpE2mqq8SQrs063VqsqxPFu8JzuIniY0N27pkJvxjzQ59Is2TXfOgTyL4J+bkvPBCAyg8FbQXCXel3S8Pq2DmiisUnd9AvnGbJ7Up1peGuFAXj76yK4lwjVFeJcbh2ue4fZhSudN3/p4/pb0ZZrrtP8ZAjHVwVZbl2u+4fprpKDLi/6jli5tpVmFG44jCsyFqTDDMKVz1tCjx2vjTXGNVVYgyue5d6AM6K0WvimyBSx149dFwxh4pen9t8pt6y5SvmitF1Xzbv2XJYpquJoQKcZW0Fd9UnczmuTXzTN/DCn2LEXI+V5zbKbk0+ddfqmCvcUv9IL0TaOZ80/bs+PoKRKcP1bPq5iZeAjXPic6juFoxqOr7+mRsd4vfhF7Bo3UZPNeS6wi95AF+0nXSFtv02L85Ub41eAz+5YbENVHfLgfrizUsMIGBRP76rCZdahiueAHR2jccQ6HaVngIWaFfFXK63fw3CLLoI8F1z5016a05e6fX+qCsGIZJk3JV+ulldN87VwLBx/t+wv7rxCtw1juyqR8/raLvqUJ8c1zZYbTZXVTuOSnd10ILD3K4alrnCddXhLzl9+Or27+ndjK4g6wbbNHDX7vGImug4TIcZiqaNjU1WeO6srjFYHZ2uS9hbw0KRHNeDqTqsKtTRJnHMsZ9Kt2hXiEfcvXgs3SSpiLg6j85j397m2NsGaR5oylxZkNSiXWEcBtf975Pn6m0s0gv1wqeIzBWniAoYFWHg4DuT7YqDHJS0a2/Ic+00b0LX8V6XsF3jx1dYp1OuI762pucSIVgdh9+9DWfr8kBcmCvw7jv0xqVA1yBluTaxIeMdm/7Vnxm22HWM9J5QqguAcdif8xtYHZqx3RNKdWkwXDnQkQXXsd0TSnURG+f/qXTF+b/kOuo1jo1zNSd9U+nG5xKGkd0TSnUR6Aov8Tlip3tCIwzvqs7VE+1qjjnjHYcV+mTDb1QFqyMK/gzDQVuBRFzxIkyHcVgmv7Xye0AvebmoBND5+BpgFK7Z86Y4Y3CNU5yrvs9LuGJanKu55OM+XgEpzPXAOPInIWjKcsU1Ds1x3hxRZgyu1rl6Yp0uzshcYRnUoSxXXMVHrN7cUJgrLZC56wuawlyjVFeJtXXdeKKmJrj3W/FLBuaKS1K4Oovv7PV3xxVr+tL88YRXmueav3YVh7keq23SUUt31b/0uwbm2kYtXX0Gi9JMlrm2kVCKg9s/8jppK5CgaztFzL3eJOP3lTYXE8/K5PfhNpyCr0r7ffiurmnz8u/4QSPPFVGNa3oHZx7X9nDND9y+a5uEMuX6nq7p+Prns7puT2//uf/znBnalScYCbbr1p/edyYD2a7H4PnmhG0QMYdrmzqNJ1HzXU1wm9qLmKrvqmsCz9lcVf/FTVGvfZ7ntFdg3WuxrquVYuuUxxu4rlQTzNtncm0flJe6PhzHdT1uZmHtO43r+sLy49FBrusxRNepLVZtM5urdb3pL/obh99rOomX0sZxZUkFeZSm40o14XVPwKo3zzXOrK7vNRc5mksBDdz1+fRzegfE2pXVNOvYFGFGV4xVQt7yVLlrM/JizmedmqmBufKnja6Mq5mfqOESJov4rsV2taKWMHGn3YO5a1sn/bkq7RrFHZvCuGNTmOoKVFeJ6ipRXSWqq0R1laiuQHWVqK4S1VViya7lQWYId6XXNB1KUlukye8BvcSt0Wua6ipRXSWqq0R1laiuQHWVqK4S1VWiukpUV4nqCizc9eSVOs3C1UVIbuSELTFXO/4Jbv1ii3HMFZe5IH+TeTqvvXo5oOuV2iYdtfSQLTIizNWKWko8Z8XK3wQ0qWGQAV0RjG5JuSIYJ4O5qjh+HzZ5fuyYKGBoV4xaynLF+KeDl7+kPxt81+Zxd3wBfmTtqnOkcCLt+g2vd2BXvUPh2ORsF5k0YNTSxvnXMEyxiDLPtdlJ3Wf8DetqPxiQPzHYddWxRpuXENCzeWnLuq4z5W+iV0Ln7pTvzKbXNK6rnTsvnltO52+iAIhovrUmf5PzhMV81+bpZFJ2d3pN47hirkBDNLccHWpof83L33TGAoUUma536Obd3QshU+msrt+wo1+sXU3+JhqHWZgmd7VSI7UJuog81zZVnPg0BnpNw1wfmd/95BVGLbEex1zbqKWtCQZYB+dNVgyqc8BR5LnuXUafskGvaWxXK2oJx2FnzCQTwI5a8nM/2K5WnTysD8l1bZ43IT09hV7TuGNTGHdsCuOOTWFyXftv1zjDubbp06Qkj4W57k9oSBKfnkKvaUbh2j49RUgcUZqr6rxgKuYBL841QnWVqK4Sw7kmnrBHr2mqq8SQrus0R1wf192LnubDw0JbgQRd7flw4vz1jplu7P8gnNVTW6QZrl3VfJhkk/Phe/BbYMbA+8KvQtuXZkDX+NME6RXQZ3/oKu3ZtH1phnSl+bC/+QruCu0+ctcIviv2dCFleFmu+Lyrva/+DTrBWPfXGKwk5rz/7m21f/vNOgrXLnNEJSvu1UBprjHG4drTHJG2L80YXJseIPbjMbjmz4cTObRp+9IM59phPqzZuxRlR+GaPx8mhK6uGIVr9nzYEMgXTtuHtPmb3sBsEPbiG3e14pvizx7Ri1d6wQ8jnNjyVa5r7nw4DjNo8ze9BStvfKWRl1SFdMmD6QfqTybLXDG/02uQxagJvlaX7RphRlcEl43vQvwDT5Agl9y8hDL63wa/D2P4Cz5Rylmrp61AenGNPgOKtq8Fo5YwCRE3kEuaFD6x2BDteqoXnVmqp95d6RlQgee/0va1YLtCqiQnqY5ckhIfRWIIFLi2fqZ7LwuF6dsVngEFL4Hn09H2NdDGw2q53aqCK8U3QczPFssi5Y9NEJpAkgt1NTOsvGOOacyD6Y8THqEVKIkj8vW/RNv19LXquMtw3X3axZVGVAxe2maybkkd30SwXLn+/gpRIcvowzuHKBl69ghtH0H5m6gjs6glpyQLpU2NwzD6UqDeYsemNupLmBRzA5O/Ke3axDchPKeq3K76aLPYY459putfmWAGTf6mjSew8VuT4DGHTzOcxFa2q87vhI/ixNHYeb4fbQXSS7vGsA3sqKVjeMMMAiWhIGtVp12t/E7Cc5FpK5ClusbJL+n34RDVFaiuEtVVorpKjME1cSWZti9NdZUY0jV6JZm2L011lRjOFZ51S0hXzWn70ozBFddfEfGqOW1fmlG4NlfN70lXzWn70izZNR/6hCZ61XxYaCuQPtoVOi/U6++sig7tSm2Rppe8XPSapkNJ+tY01VViSNdu1/1DjMKVrvv/9DH9zSjLdfcpHnJCz82nb00zBtdu1/3DVFeJvl2bGb0UFMx/FT1HzF27CrICrlJAJXfV97Vnr0mGWAVX6+7QBlaHnjaJ96KNxVU3FiCcqdFrmrG5+p24NFfThyV4Sd3uGTE/Ucbhqk/mcuObaIV845zfcM9d26glfMfzCzBXXOZqV+Dt9fdc190/yPNbjfOrHMHIlOF6/CksG+PmQIRWxLV9Kp2TnwlgrsefqDqfQZ34TtduyHON47hC236b24dx3fjNySfbMVekXUvlWZn8Pvxes2rJV6UX4YonAF1cFV1c2yfVAb274n1FsC9KB07fNXve1KyYJ12tjCCJdm1X4Z3nLeW5YvywvrYyXx4C+lYExyazMVFXHJEaVZ5ETRibMDQB3zHVTFdsrf0JaEp33dBrGq9dm4fBJdu1eSqdm6rIa9fNZ6bnto+aQzq46lMX6Wo+vWq6XZcw8Tvp/dXksrFzPgH+/trGBDkxjrQVSHx/3f8+x7XjdQkTR5l2pfgdlvMJ8F3b2EwepZnpekdNEPa+UuNSKkcKxCPuXjwWz4ck167tauVnInpv1/YKtzAQ2yWht4Or7gQutuvm5Qfww2fsr9ZT6ZqcTy22Kz4bHcOl9DtTuybX1cSjSc0luWZcl8DAd+xjmLeTp8dj7dpELeGArLAnTqxd2zrbdw35rmHskrBOp1zX4trazuF3b8OBWB6IC3MF3n2H3rgU6BqkLNfmCkZ6bIoyBtfe7qcjkzSLclUDD72zEUrmxYVHGNDVXPVNziUM473eRKdzgLAfSq7jX+PI7sNSwI9iHO2qr/anXc3YNB3v/hrFLmmOOWMeh6Nn4PSaZhSu5gxcXJLq4DostBVIZH/FHZVuDHTp4EptkSa/B/Qdo2fG4cCRhF7TVFeJ4Vzp8hEFubgU5mrmiLp5HQpz1bNE+UJoca4xqqtEdZWorhLVVaK6Auz/xLOU0muaUbhiDAFeQ5KylNJrmjG4JrKU0msa5orPpzNr5Cc3PJKHubaxSrgixcOWmGsbCQWxBgp7BTPXFSaHPbtefW6ilhTPb2/Crm2s0jbkg+Ew1zZ/05zPWbkPgbLzxUvQt7ZQJM/p9KOIK4LxOylXBPM3OREkQJ4rGoazlNJrmqDr1fVJz648CArJdMVrMN+9fSguNs/hSlFLZ7cfplx11FKOK9bJs6NoMl1BNnBlbWZXHJtQFTxjrm2sEo5NLDBAGJsgzODk5mt4y4RzXWPM6AroqKWHqr+l2tWKVTpmsRVeu2L+Jl3xKZMd2FVtzRdq47DTJfbXUHSLv7/qPD9YHUt+k+tKKzq9X2+C/QpDPwA7rxSZtISilnxXqJP211lc6fqwQrhqOo+riUbru11pHGZhmnmu+vowTCMgqMtlNtfT6W/A0PzwEdc2VmnjHN8F501W/qYzELaCUxV5rnousffVx+LC6myubdQSEmvXaNQSa1erTpwisqlTJ9dLNW/qb44Yxe/DIfw+HCLPVffh/R9UuxbvSteHQbj4czotG5o4leYao7pKVFeJ6ipRXSWqK1BdJaqrxMq6lgeZIcx1ESyir7z+S3qTpLouiuoqUV0lqqtEdV0U1VWiONf2ip1HfknHNbfO5bo2t3xI93zwks3tQf6iA3eNlhzQ9cg4Jp+NdmS2XCrJXKMlh3O1bn1u8vi2BEoK0Rq2a7zkcK64YqJJrCWYCHyFUNJ2jZdcCVf9zB1GwFW4dS3gmno2+nL312a1RLoVJlBSuOWf7a/RkgO67k+oYY9S95nqTDQKqSRzjZYc0DVKfknmGqW6LgrHYH3mTTv3YKuA1LyJ8rMoUvOmaMkBXe9QTM3uRWociZZkrvl1LtW1zY6UOuZYJRPHnHjJ4VyttAzJuUTTIZNziVjJIV3XaY64Pu3anolIt5oGSjb7Ywsbm6IlB3Tdn9DwkTzXjJZkrvl1Ltd155AOhel4zibbm1CSuUZLDumqOhpslXAk9Evi9RqxJHfNrnPZrhHySzquEarrolhX1yZbmSJ1fKViitTxlYopVun4am9X/FgYLxlyXaXjqzVHFOAl/WNlC3eNlayui6K6SpTlGie/pO0aZzjXpl3xlgkXXtKMqc1t8xbMNf+++oH6sLDM5JQ0B5C86/6YAS91D8ZArtYZdgMv+XvzkMqsc3V0XbHrEnTQV6TmTY9NN866BrPartRqFo6r+gf3RKG7+674hFKh5JCunY45FB3g93a+vyrDvPvqV9lV9UpRgLvSffVHUlcZ0LXTM3nonQRzBVl/RyWGc42TX5K7xqiui6K6SlRXieoqUV0XRXWVqK4S1VViya7DQluBLNx1haiuZVJdy6S6lkl1LZPqWiI7O/8PdMillJtaV1oAAAAASUVORK5CYII=`;
}
