const prefix = '@nimble'

export const store = {
    get<O>(key:string):O|null {
        let stored = localStorage.getItem(`${prefix}.${key}`)
        return stored ? JSON.parse(stored) : null
    }
}