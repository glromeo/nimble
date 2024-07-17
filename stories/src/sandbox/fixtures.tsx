import {removeParameters} from './parameters'
import {Fixture} from './fixture'
import {computed, effect, Signal} from '@nimble/toolkit/signals/signals.mjs'

import './fixtures.scss'
import {store} from '../local-storage'

Object.defineProperty(window, 'fixture', {
    configurable: true,
    enumerable: true,
    value: () => Promise.reject(`'fixture' is not supported at module level`)
})

export function Fixtures({
                             story,
                             titles,
                             module,
                             onFocus
                         }: {
    story: string;
    titles: string[];
    module: Record<string, () => Node>;
    onFocus: (titles: string[]) => void;
}) {
    const context = JSON.stringify([story, ...titles])
    if (store.get("context") !== context) {
        JSON.parse(localStorage.getItem(`atx-stories.context`) ?? '[]').forEach(removeParameters)
        localStorage.setItem(`atx-stories.context`, context)
    }
    const components = titles.map((title) => module[title])

    Object.defineProperty(window, 'fixture', {
        configurable: true,
        value: (component?: () => Node | string | null, timeout: number = 5000) =>
            new Promise((resolve, reject) => {
                try {
                    const titles = Object.keys(module)
                    const fixtureIndex = getFixtureIndex(module, component)
                    onFocus(titles.slice(fixtureIndex, fixtureIndex + 1))
                    setTimeout(() => reject('timed out trying to get fixture'), timeout)
                    requestAnimationFrame(function tryGetFixtureElement() {
                        let rootElement = document.getElementById('fixtures')!
                        let fixtureElement = rootElement.querySelector(`[data-fixture="${titles[fixtureIndex]}"]`)
                        if (fixtureElement) {
                            resolve(fixtureElement)
                        } else {
                            requestAnimationFrame(tryGetFixtureElement)
                        }
                    })
                } catch (error:any) {
                    reject(error.message)
                }
            })
    })

    return (
        <div id="fixtures" class="fixtures graph-paper">
            {components.map((Component, index) => {
                const title = titles[index]
                return (
                    <Fixture story={story} title={title} edge={true}>
                        <Component/>
                    </Fixture>
                )
            })}
        </div>
    )
}

function getFixtureIndex(module: Record<string, ()=>Node>, component?: (()=>Node) | string | null): number {
    let fixtureIndex: number
    if (typeof component === 'string') {
        fixtureIndex = Object.keys(module).indexOf(component || 'default')
        if (fixtureIndex < 0) {
            throw new Error(component ? `not a fixture: ${component}` : 'no default fixture')
        }
    } else {
        fixtureIndex = component ? Object.values(module).indexOf(component) : Object.keys(module).indexOf('default')
        if (fixtureIndex < 0) {
            throw new Error(component ? `not a fixture: ${component.name}` : 'no default fixture')
        }
    }
    return fixtureIndex
}
