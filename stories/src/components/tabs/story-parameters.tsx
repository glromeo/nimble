import React from "react";
import { useAtom, useAtomValue } from "jotai";
import { parametersFamily, Parameter } from "../../hooks/parameters";
import { AtxCheckboxGroup, AtxDropdown, AtxTextField } from "@atx/toolkit/components";
import { AtxToggle } from "@atx/toolkit/components/widgets";

import "./story-parameters.scss";

export function StoryParameters({ story, titles }: { story: string; titles: string[] }) {
    return (
        <div className="story-parameters">
            {titles.map((title) => (
                <FixtureParameters key={title} title={title} frame={titles.length > 1} />
            ))}
        </div>
    );
}

function FixtureParameters({ title, frame }: { title: string; frame: boolean }) {
    const parameters = Object.values(useAtomValue(parametersFamily(title)));
    return parameters.length ? (
        <table key={title} className={`form ${frame ? "framed" : "frameless"}`} cellPadding="0" cellSpacing="0">
            <thead>
                <tr>
                    <th className="title" title={`story: ${title}`} colSpan={2}>
                        {title.replace(/[-_]/g, " ")}
                    </th>
                </tr>
            </thead>
            <tbody>
                {parameters.map(({ label, type, atom }, index) => (
                    <tr key={index}>
                        <td className="label">{label}</td>
                        <td className="field">
                            <FixtureParameter label={label} type={type} atom={atom} />
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    ) : null;
}

function FixtureParameter({ type, label, atom }: Parameter<any>): JSX.Element {
    const [value, setValue] = useAtom(atom);
    if (Array.isArray(type)) {
        return <AtxDropdown value={value} options={type} onChange={setValue} />;
    }
    if (typeof type === "object") {
        const { render, options } = type;
        if (Array.isArray(options)) {
            return <AtxDropdown value={value} options={options} onChange={setValue} />;
        } else {
            return <AtxCheckboxGroup checked={options} onChange={setValue} />;
        }
    }
    switch (type) {
        case "number":
            return <AtxTextField value={value as number} format={String} parse={Number} onChange={setValue} />;
        case "boolean":
            return <AtxToggle value={value as boolean} onChange={setValue} />;
        case "date":
            return <AtxToggle value={value as boolean} onChange={setValue} />;
        case "checkboxes":
            return <AtxCheckboxGroup checked={value as Record<string, boolean>} onChange={setValue} />;
        default:
            return <AtxTextField value={value} onChange={setValue} />;
    }
}
