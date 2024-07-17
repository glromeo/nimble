import {initJasmine} from './sandbox/jasmine'
import {Story} from './sandbox/story'
import {loadStory} from './loader'
import {TkApp} from '@nimble/toolkit/components/tk-app'
import './index.scss'

const story = location.hash.slice(2)

const params = new URLSearchParams(location.search)
const fixture = params.get('fixture')
const specs = params.get('specs')
const spec = initJasmine(story)

Object.defineProperty(window, '$', {value: require('jquery')})

loadStory(location.hash).then((module) => {
    document.body.append(
        <TkApp>
            <Story module={module} story={story} fixture={fixture} spec={spec}/>
        </TkApp> as Node
    )
})
