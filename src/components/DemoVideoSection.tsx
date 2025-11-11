import React from 'react';
import { Link } from 'react-router-dom';
export const DemoVideoSection: React.FC = () => {
  return (
    <section className="mb-8 animate-fade-in">
      <div className="text-center mb-4">
        <h2 className="text-xl font-semibold text-foreground mb-1">
          See Notewell AI in Action
        </h2>
        <p className="text-sm text-muted-foreground">
          Watch our quick demo
        </p>
      </div>
      
      <div className="flex justify-center">
        <Link
          to="/demos"
          className="inline-flex items-center px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 shadow border border-border"
        >
          View demo videos
        </Link>
      </div>
    </section>
  );
};
