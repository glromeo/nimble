import "./style.scss";

export function Home() {
    return (
        <div class="home">
            <button onClick={() => location.pathname += "guests"}>Guests</button>
            <button onClick={() => location.pathname += "floorplan"}>Floorplan</button>
            <button onClick={() => location.pathname += "flyers"}>Flyers</button>
        </div>
    );
}
