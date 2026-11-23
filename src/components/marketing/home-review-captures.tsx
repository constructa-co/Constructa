import { captures, CapturePicture } from './product-screenshots';
import ui from './phase-one.module.css';
import shots from './product-screenshots.module.css';

export function HomeReviewCaptures() {
  return (
    <section id="review-captures" aria-labelledby="review-captures-title" className={`${ui.section} ${shots.screenshots}`}>
      <div className={ui.sectionIntro}>
        <p className={ui.eyebrow}>Actual review screens</p>
        <h2 id="review-captures-title">The interface behind the journey.</h2>
        <p>
          Two steps from the current phase-one review: setting price percentages on an estimate, and saving a programme
          ready for proposal review.
        </p>
      </div>

      <p className={shots.qualification}>
        These are synthetic journey fixture captures from 15 November 2026. They show the current review interface with
        made-up data and simulated saves. Live signup, email and production saving require separate verification. Controls
        may still change before release.
      </p>

      <div className={shots.figures}>
        {captures.map(capture => (
          <figure key={capture.title} className={shots.figure}>
            <CapturePicture capture={capture} />
            <figcaption>
              <div>
                <h3>{capture.title}</h3>
                <p className={shots.capturedLine}>
                  Synthetic journey fixture capture · <time dateTime={capture.capturedOn}>{capture.capturedLabel}</time> ·
                  Current review interface · Simulated saves
                </p>
              </div>
              <div>
                <p>{capture.description}</p>
                <p>{capture.sample}</p>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
