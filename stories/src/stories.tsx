import {Stories} from './components/stories'
import {TkApp} from '@nimble/toolkit/components/tk-app'
import {signal} from '@nimble/toolkit/signals/signals.mjs'

import './index.scss'

const stories = signal(null)

window.stories.then(s => stories.set(s))

window.addEventListener('message', ({data}) => {
    if (data === 'reload') {
        window.stories.then(s => stories.set(s))
    }
})

document.body.append(
    <TkApp>
        <Stories stories={stories}/>
    </TkApp> as Node
)
