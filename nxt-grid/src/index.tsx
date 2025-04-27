import {PsGrid} from "./grid";

import './style.css';
import './grid/style.css';

import data from "./assets/simple.csv";

function Showcase() {

    // requestAnimationFrame(() => {
    //     const grid = document.querySelector(".left-grid")!;
    //     grid.scrollTop = 0;
    //     let i = setInterval(() => {
    //         grid.scrollTop += 200;
    //     }, 250);
    //     setTimeout(() => {
    //         clearInterval(i)
    //     }, 5000)
    // });

    return (
        <div class="grid-flex-container">
            <PsGrid className="left-grid" inverse={false} rowData={data.slice(1)} columnDefs={[
                {label: "Id"},
                {label: "First Name"},
                {label: "Last Name"},
                {label: "Email"},
                {label: "Gender"},
                {label: "Ip Address"},
                {label: "Trade Id"},
                {label: "Stock Symbol"},
                {label: "Trade Date"},
                {label: "Trade Time"},
                {label: "Trade Price"},
                {label: "Trade Quantity"},
                {label: "Buyer Id"},
                {label: "Seller Id"},
                {label: "Trade Type"},
                {label: "Commission Fee"},
            ]}>
            </PsGrid>
            {/*<PsGrid class="right-grid" inverse={false} rowData={data.slice(1)}>*/}
            {/*    <PsGrid.Column label="Id" pinned={true}/>*/}
            {/*    <PsGrid.Column label="First Name" pinned={true}/>*/}
            {/*    <PsGrid.Column label="Last Name" pinned={true}/>*/}
            {/*    <PsGrid.Column label="Email"/>*/}
            {/*    <PsGrid.Column label="Gender"/>*/}
            {/*    <PsGrid.Column label="Ip Address"/>*/}
            {/*    <PsGrid.Column label="Trade Id"/>*/}
            {/*    <PsGrid.Column label="Stock Symbol"/>*/}
            {/*    <PsGrid.Column label="Trade Date"/>*/}
            {/*    <PsGrid.Column label="Trade Time"/>*/}
            {/*    <PsGrid.Column label="Trade Price"/>*/}
            {/*    <PsGrid.Column label="Trade Quantity"/>*/}
            {/*    <PsGrid.Column label="Buyer Id"/>*/}
            {/*    <PsGrid.Column label="Seller Id"/>*/}
            {/*    <PsGrid.Column label="Trade Type"/>*/}
            {/*    <PsGrid.Column label="Commission Fee"/>*/}
            {/*</PsGrid>*/}
        </div>
    );
}

document.body.append(<Showcase/>);
