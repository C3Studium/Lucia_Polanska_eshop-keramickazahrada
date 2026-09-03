import React from 'react';

/**
 * Utility function to render text with line breaks — for editorial text from the CMS
 * Handles \n line breaks, HTML tags, and provides safe rendering
 */
export const renderTextWithBreaks = (text: string): React.ReactNode => {
  if (!text) return null;

  // If text contains HTML tags, render as HTML (rich text from the CMS)
  if (text.includes('<') && text.includes('>')) {
    return <span dangerouslySetInnerHTML={{ __html: text }} />;
  }

  // Otherwise, handle line breaks by splitting on \n
  return text.split('\n').map((line, index) => (
    <span key={index}>
      {line}
      {index < text.split('\n').length - 1 && <br />}
    </span>
  ));
};

/**
 * Safe version that only handles line breaks without HTML
 * Use this when you want to avoid HTML injection
 */
export const renderTextWithLineBreaks = (text: string): React.ReactNode => {
  if (!text) return null;

  return text.split('\n').map((line, index) => (
    <span key={index}>
      {line}
      {index < text.split('\n').length - 1 && <br />}
    </span>
  ));
};
