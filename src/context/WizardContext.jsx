/* eslint-disable react/only-export-components */
import { createContext, useContext, useState } from 'react';

const WizardContext = createContext(null);

export function WizardProvider({ children }) {
  const [userId] = useState('test-user-1'); // fixed placeholder until auth is added
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [brandKit, setBrandKit] = useState(null);
  const [concept, setConcept] = useState(null); // { conceptTitle, imagePrompt }
  const [selectedImageUrl, setSelectedImageUrl] = useState(null);
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState([]);
  const [scheduledTime, setScheduledTime] = useState(null); // ISO string or null for immediate

  return (
    <WizardContext.Provider
      value={{
        userId,
        websiteUrl,
        setWebsiteUrl,
        brandKit,
        setBrandKit,
        concept,
        setConcept,
        selectedImageUrl,
        setSelectedImageUrl,
        caption,
        setCaption,
        hashtags,
        setHashtags,
        scheduledTime,
        setScheduledTime,
      }}
    >
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard() {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error('useWizard must be used within a WizardProvider');
  return ctx;
}
