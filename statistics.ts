
export class Statistics {
    public casinoBalance: number;

    constructor() {
        this.casinoBalance = 0;
    }

    public toJSON() : any {
        return {
            casinoBalance: this.casinoBalance,
        };
    }

    public static fromJSON(obj: any) : Statistics {
        var stats = new Statistics();
        stats.casinoBalance = obj.casinoBalance;
        return stats;
    }
}