import React from "react";
import { Composition } from "remotion";
import { Promo, DURATION } from "./Promo";
import { Verify } from "./verify/Verify";
import VT from "./verify/timeline.json";
import { Film, FILM_DURATION } from "./film/Film";
export const Root: React.FC = () => (
	<>
		<Composition id="Promo" component={Promo} durationInFrames={DURATION} fps={30} width={1920} height={1080} />
		<Composition id="Verify" component={Verify} durationInFrames={VT.duration} fps={VT.fps} width={1920} height={1080} />
		<Composition id="Film" component={Film} durationInFrames={FILM_DURATION} fps={30} width={1920} height={1080} />
	</>
);
