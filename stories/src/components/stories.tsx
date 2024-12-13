import {Navigator} from "./navigator";
import {computed, effect, JSX, signal, Signal, storedSignal} from "@nimble/toolkit";

import "./stories.scss";

const settings = storedSignal("stories.settings", {
    tabIndex: 0 as number | null,
    navigator: {
        width: 200
    }
});

const tabIndex = signal<number | null>(settings.get().tabIndex);
const navigatorWidth = signal<number>(settings.get().navigator.width);

effect(() => {
    settings.set({
        tabIndex: tabIndex.get(),
        navigator: {
            width: navigatorWidth.get()
        }
    });
});

export function Stories(props: { stories: Record<string, string[]> }): JSX.Element {

    const $story = signal(location.hash.slice(2));

    const $fixture = signal(new URLSearchParams(location.search).get("fixture"));

    const $titles = computed(() => {
        const fixture = $fixture.get();
        if (fixture) {
            return [fixture || "default"];
        } else {
            const {stories} = props;
            return stories && stories[$story.get()] || [];
        }
    });

    const $focused = signal($titles.get());

    effect(() => {
        const url = new URL(location.href);
        if ($story) {
            url.hash = `#/${$story.get()}`;
        }
        const focused = $focused.get();
        if (focused.length === 1) {
            url.searchParams.set("fixture", focused[0]!);
        }
        history.replaceState({}, "", url);
    });

    return (
        <div class="stories">
            <div class="navigator-pane"
                 style={`min-width: 200px, width: ${navigatorWidth.get()}px`}
                 is:resizable="right"
                 on:resized={e => {
                     const div = e.currentTarget as HTMLDivElement;
                     navigatorWidth.set(div.getBoundingClientRect().width);
                 }}>
                <Navigator
                    defaultOpen={true}
                    stories={props.stories}
                    titles={$titles.get()}
                    $selected={$story}
                    $focused={$focused}
                />
            </div>
            <div class="flex-column flex-grow">
                {/*<IFrame story={story} titles={titles}/>*/}
                {/*<div*/}
                {/*    class="details"*/}
                {/*    resizable="top"*/}
                {/*    style={{height: settings.layout.bottom ?? 300}}*/}
                {/*    on:resized={({height}) => {*/}
                {/*        updateSettings({layout: {bottom: height}}, false);*/}
                {/*    }}*/}
                {/*>*/}
                {/*    <AtxTabbedPane state={activeTab}>*/}
                {/*        <StoryParameters tab-title="Parameters" story={story} titles={titles}/>*/}
                {/*        <Jasmine tab-title="Tests" story={story}/>*/}
                {/*    </AtxTabbedPane>*/}
                {/*</div>*/}
            </div>
        </div>
    );
}
