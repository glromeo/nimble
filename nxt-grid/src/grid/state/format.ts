import {Nullable} from "../types";

export function formatTime(value: Nullable<Date> = null): string {
    if (value) {
        return value.toTimeString().substring(0, 8);
    }
    return "";
}

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDate(value: Nullable<Date> = null): string {
    if (value) {
        return `${value.getDate()}-${months[value.getMonth()]}-${value.getFullYear()}`;
    }
    return "";
}

export function formatDateTime(value: Nullable<Date> = null): string {
    if (value) {
        return value.toISOString().slice(0, -5).replace("T", " ");
    }
    return "";
}

export function formatTimer(value: Nullable<number>): string {
    if (value) {
        return new Date(value).toISOString().substring(11, 19);
    }
    return "";
}

const priceFormat = Intl.NumberFormat(navigator.language, {
    style: "currency",
    currency: "USD",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

const spreadFormat = Intl.NumberFormat(navigator.language, {
    signDisplay: "always",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

const quantityFormat = Intl.NumberFormat(navigator.language, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3
});

const scoreFormat = Intl.NumberFormat(navigator.language, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
});

const bpsFormat = Intl.NumberFormat(navigator.language, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

export function formatPrice(price: Nullable<number>, na = "-"): string {
    if (price && !isNaN(price)) {
        return priceFormat.format(price);
    } else {
        return price === 0 ? "$0.00" : na;
    }
}

export function parsePrice(price: string | null): number | null {
    if (price) {
        return Number(price.replace(/[\s,]/g, ""));
    }
    return null;
}

export function formatScore(score: Nullable<number>, na = "-"): string {
    if (score && !isNaN(score)) {
        return scoreFormat.format(score);
    } else {
        return score === 0 ? "0" : na;
    }
}

export function formatYield(yi3ld: Nullable<number>, na = "-"): string {
    if (yi3ld && !isNaN(yi3ld)) {
        return priceFormat.format(yi3ld);
    } else {
        return yi3ld === 0 ? "0.00" : na;
    }
}

export function formatSpread(spread: Nullable<number>, na = "-"): string {
    if (spread && !isNaN(spread)) {
        return spreadFormat.format(spread);
    } else {
        return spread === 0 ? "+0.00" : na;
    }
}

export function parseSpread(spread: string | null): number | null {
    if (spread) {
        return Number(spread.replace(/[\+s,]/g, ""));
    }
    return null;
}

export function formatQuantity(quantity: Nullable<number>, na = "-"): string {
    if (quantity && !isNaN(quantity)) {
        // if (quantity >= 1_000_000_000) {
        //     return `${Math.floor(quantity / 10_000_000) / 100}B` as Quantity;
        // }
        // if (quantity >= 1_000_000) {
        //     return `${Math.floor(quantity / 10_000) / 100}M` as Quantity;
        // }
        // if (quantity >= 1_000) {
        //     return `${Math.floor(quantity / 10) / 100}K` as Quantity;
        // }
        // return String(quantity) as Quantity;
        return quantityFormat.format(quantity);
    } else {
        return quantity === 0 ? "0" : na;
    }
}

export function formatBps(value: number | null, basis: number | null): string {
    if ((basis || basis === 0) && (value || value === 0)) {
        return `${bpsFormat.format(Math.abs(value - basis))} bps`;
    } else {
        return "";
    }
}

export function parseQuantity(quantity: string | null): number | null {
    if (quantity) {
        const split = quantity.replace(/[\s,]/g, "").split(/m/i);
        return Number(split[0]) * Math.pow(10, 3 * (split.length - 1));
    }
    return null;
}

export function getYesterdaysDateAsEpoch() {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    date.setHours(0, 0, 0, 0);

    return date.getTime();
}

export function formatPercentage(value: Nullable<number>): string {
    if (value && !isNaN(value)) {
        return `${Math.round(value * 100) / 100}%`;
    } else {
        return value === 0 ? "0% " : "-";
    }
}
