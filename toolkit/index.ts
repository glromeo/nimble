export * from './atoms/atoms.js'
export * from './html/html.js'
export * from './html/css.js'
export * from './html/util.js'
export * from './test/index.js'

import {defaultStore} from './atoms/atoms.js'
import {html} from './html/html.js'

export function render(template: ReturnType<typeof html>) {
    const root = document.getElementById('root') as HTMLElement
    root.innerHTML = ''
    template(defaultStore, root)
}
