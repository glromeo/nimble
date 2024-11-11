import {Floorplan} from "./pages/floorplan";
import {Flyers} from "./pages/flyers";
import {Guests} from "./pages/guests";
import {Home} from "./pages/home";

import "./style.css";

function Route() {
    switch (location.pathname) {
        case "/floorplan":
            return <Floorplan/>;
        case "/flyers/":
            return <Flyers/>;
        case "/guests/":
            return <Guests/>;
        case "/":
            return <Home/>;
        default:
            alert(`Unknown path: ${location.pathname}`);
    }
}

document.body.appendChild(<Route/>);
