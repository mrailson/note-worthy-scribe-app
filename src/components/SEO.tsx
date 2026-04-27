import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title: string;
  description: string;
  canonical?: string;
  keywords?: string;
  image?: string;
}

export const SEO = ({ 
  title, 
  description, 
  canonical = 'https://www.gpnotewell.co.uk',
  keywords = 'GP practices, AI consultation notes, NHS primary care, clinical documentation, practice management',
  image = 'https://storage.googleapis.com/gpt-engineer-file-uploads/RQoagFPm5HYcurIbFgZkOOrMMNk2/social-images/social-1758101447450-Image%20Notewell%20Screen.png'
}: SEOProps) => {
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <link rel="canonical" href={canonical} />
      
      {/* Favicon - ensure consistent robot icon across all pages */}
      <link rel="icon" href="/favicon.ico" sizes="any" />
      <link rel="icon" type="image/png" sizes="32x32" href="/notewell-favicon-32x32.png" />
      <link rel="icon" type="image/png" sizes="192x192" href="/notewell-favicon-192x192.png" />
      <link rel="apple-touch-icon" sizes="180x180" href="/notewell-favicon-180x180.png" />
      
      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={image} />
      <meta property="og:type" content="website" />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </Helmet>
  );
};
