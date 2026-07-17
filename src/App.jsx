import { useState } from 'react';
import { WizardProvider } from './context/WizardContext';
import TopBar from './components/TopBar';
import DbStatusBadge from './components/DbStatusBadge';
import FilmRail from './components/FilmRail';
import Step1Url from './components/steps/Step1Url';
import Step2Developing from './components/steps/Step2Developing';
import Step3BrandKit from './components/steps/Step3BrandKit';
import Step4Prompt from './components/steps/Step4Prompt';
import Step5Images from './components/steps/Step5Images';
import Step6Caption from './components/steps/Step6Caption';
import Step7Connect from './components/steps/Step7Connect';
import Step8Dashboard from './components/steps/Step8Dashboard';

const STEPS = [
  Step1Url,
  Step2Developing,
  Step3BrandKit,
  Step4Prompt,
  Step5Images,
  Step6Caption,
  Step7Connect,
  Step8Dashboard,
];

function App() {
  const [step, setStep] = useState(1);
  const [maxUnlocked, setMaxUnlocked] = useState(1);

  const goTo = (n) => {
    setStep(n);
    setMaxUnlocked((m) => Math.max(m, n));
  };
  const next = () => goTo(Math.min(step + 1, STEPS.length));

  const StepComponent = STEPS[step - 1];

  return (
    <WizardProvider>
      <div className="min-h-screen bg-ink text-paper font-body pb-20">
        <TopBar />
        <FilmRail current={step} onJump={goTo} maxUnlocked={maxUnlocked} />
        <div className="max-w-4xl mx-auto px-6">
          <div className="py-16">
            <StepComponent onNext={next} onDone={next} />
          </div>
        </div>
        <DbStatusBadge />
      </div>
    </WizardProvider>
  );
}

export default App;
