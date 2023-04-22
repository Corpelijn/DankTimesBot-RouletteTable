
export class BetInfo {
    public static knownBets = new Map<string, BetInfo>();

    constructor(public texts: Array<string>, public numbers: Array<number>, public multiplier: number) {
    }

    public getNumbers(): string {
        return `<code>[${this.numbers}]</code>`.replace('100', '00');
    }

    public static init(): void {
        let betInfo = new Array<BetInfo>();

        // Add the Straight Up bets
        for (let digit = 1; digit <= 36; digit++) {
            betInfo.push(new BetInfo([`${digit}`], [digit], 36));
        }
        betInfo.push(new BetInfo(['0'], [0], 36));
        betInfo.push(new BetInfo(['00'], [100], 36));

        // Add the Split bets
        for (let digit = 1; digit <= 36; digit++) {
            if (digit % 3 !== 0) {
                betInfo.push(new BetInfo(
                    [`${digit}|${digit + 1}`, `${digit}-${digit + 1}`],
                    [digit, digit + 1],
                    18));
            }

            if (digit <= 33) {
                betInfo.push(new BetInfo(
                    [`${digit}_${digit + 3}`, `${digit}-${digit + 3}`],
                    [digit, digit + 3],
                    18));
            }
        }

        // Add the Street bets
        for (let digit = 1; digit <= 34; digit += 3) {
            betInfo.push(new BetInfo(
                [`|${digit}`, `${digit + 2}|`, `${digit}-${digit + 2}`],
                [digit, digit + 1, digit + 2],
                12));
        }

        // Add the Trio bets
        betInfo.push(new BetInfo([`0-1-2`], [0, 1, 2], 12));
        betInfo.push(new BetInfo([`00-2-3`], [100, 2, 3], 12));
        betInfo.push(new BetInfo([`0-00-2`], [0, 100, 2], 12));

        // Add the Basket bet
        betInfo.push(new BetInfo([`0-00-1-2-3`, `BASKET`], [0, 100, 1, 2, 3], 7));

        // Add the Sixline bets
        for (let digit = 1; digit <= 31; digit += 3) {
            betInfo.push(new BetInfo(
                [`${digit}-${digit + 5}`],
                [digit, digit + 1, digit + 2, digit + 3, digit + 4, digit + 5],
                6));
        }

        // Add the Corner bets
        for (let digit = 1; digit <= 32; digit++) {
            if (digit % 3 === 1) {
                betInfo.push(new BetInfo(
                    [`${digit}+${digit + 4}`, `${digit}-${digit + 4}`],
                    [digit, digit + 1, digit + 3, digit + 4],
                    9));
            }
        }

        // Add the Column bets
        betInfo.push(new BetInfo(
            [`COL1`, `colL`, `C1`, `1-34`],
            [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
            3));
        betInfo.push(new BetInfo(
            [`COL2`, `colM`, `C2`, `2-35`],
            [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
            3));
        betInfo.push(new BetInfo(
            [`COL3`, `colR`, `C3`, `3-36`],
            [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
            3));

        // Add the Dozen bets
        betInfo.push(new BetInfo(
            [`1D`, `D1`, `1-12`, `12P`],
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
            3));
        betInfo.push(new BetInfo(
            [`2D`, `D13`, `13-24`, `12M`],
            [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
            3));
        betInfo.push(new BetInfo(
            [`3D`, `D25`, `25-36`, `12D`],
            [25, 26, 27, 28, 29, 30, 31, 32, 34, 35, 36],
            3));

        // Add the Snake bet
        betInfo.push(new BetInfo([`SNAKE`], [1, 5, 9, 12, 14, 16, 19, 23, 27, 30, 32, 34], 3));

        // Add the Even Chances bets
        betInfo.push(new BetInfo(
            [`1-18`, `LOW`],
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
            2));
        betInfo.push(new BetInfo(
            [`19-36`, `HIGH`],
            [19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36],
            2));

        betInfo.push(new BetInfo(
            [`ODD`],
            [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35],
            2));
        betInfo.push(new BetInfo(
            [`EVEN`],
            [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36],
            2));

        betInfo.push(new BetInfo(
            [`RED`],
            [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36],
            2));
        betInfo.push(new BetInfo(
            [`BLACK`],
            [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35],
            2));

        // Add all bets into a single map
        betInfo.forEach(bet => {
            bet.texts.forEach(t => {
                this.knownBets.set(t.toLowerCase(), bet);
            });
        });
    }
}