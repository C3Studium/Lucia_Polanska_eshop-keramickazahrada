import Carousel from "./Carousel";
import Intro from "./intro";

export default function IntroSection() {
    return (
        <div style={{ backgroundColor: "var(--bgPrimary)"}}>
            <Intro />
            <Carousel />
        </div>
    )
}