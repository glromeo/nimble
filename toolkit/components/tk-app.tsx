import "./tk-app.scss";
import {JSX} from '@nimble/toolkit'

export function TkApp({children}:{children?:JSX.Element}) {
    return (
        <div class="tk-app d-flex flex-column w-100 h-100 overflow-hidden">
            {children}
        </div>
    )
}
