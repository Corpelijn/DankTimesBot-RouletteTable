
export class Statistics {
    public casinoBalance: number;
    private numbers: WinNumber[] = [];

    constructor() {
        this.casinoBalance = 0;

    }

    public getNumberDistribution(): string {
        const counters = new Map<string, number>();

        const groupedNumbers = this.groupBy(this.numbers, k => k.number);

        counters.set('00', groupedNumbers.get(100)?.length ?? 0);

        for (let i = 0; i <= 36; i++) {
            const count = groupedNumbers.get(i);
            if (count) {
                counters.set(i.toString(), count.length);
            } else {
                counters.set(i.toString(), 0);
            }
        }
        
        const groupedColors = this.groupBy(this.numbers, k => k.color);
        counters.set(`🟥`, groupedColors.get(`🟥`)?.length ?? 0);
        counters.set(`⬛️`, groupedColors.get(`⬛️`)?.length ?? 0);
        counters.set(`🟩`, groupedColors.get(`🟩`)?.length ?? 0);


        let final = '';
        counters.forEach((count, key) => {
            final += `${key.padStart(2, ' ')}   -->   ${count}\n`;
        });

        return final;
    }

    public addNumber(number: number, color: string) {
        this.numbers = this.numbers.slice(-399);
        this.numbers.push(new WinNumber(number, color));
    }

    private groupBy<T, K>(list: T[], getKey: (item: T) => K): Map<K, T[]> {
        const map = new Map<K, T[]>();
        list.forEach((item) => {
            const key = getKey(item);
            const collection = map.get(key);
            if (!collection) {
                map.set(key, [item]);
            } else {
                collection.push(item);
            }
        });
        return map;
    }

}

class WinNumber {
    constructor(public number: number, public color: string) {

    }
}