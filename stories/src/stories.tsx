import {Stories} from './components/stories'
import {TkApp} from '@nimble/toolkit/components/tk-app'
import {signal} from '@nimble/toolkit/signals/signals'

import './index.scss'

const $stories = signal<Record<string, string[]>>({})

window.stories.then(s => $stories.set(s))

window.addEventListener('message', ({data}) => {
    if (data === 'reload') {
        window.stories.then(s => $stories.set(s))
    }
})

document.body.append(
    <TkApp>
        <Stories stories={$stories.get()}/>
    </TkApp> as Node
)
