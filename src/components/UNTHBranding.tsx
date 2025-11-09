import React from 'react';

// Plastic Surgery Logo
export const UNTHLogo = () => (
  <div className="flex items-center space-x-3">
    <img 
      src="/logo.png" 
      alt="Plastic Surgery Logo" 
      className="w-12 h-12 object-contain"
    />
    <div className="text-left">
      <div className="text-lg font-bold text-clinical-dark">Plastic Surgery</div>
      <div className="text-xs text-clinical">UNTH, Ituku/Ozalla</div>
    </div>
  </div>
);

// Hospital branding configuration
export const hospitalBranding = {
  name: "University of Nigeria Teaching Hospital",
  shortName: "UNTH",
  location: "Ituku/Ozalla, Enugu",
  fullAddress: "University of Nigeria Teaching Hospital, Ituku/Ozalla, Enugu, Nigeria",
  phone: "+234 703 132 2008",
  email: "info@unth.edu.ng",
  website: "https://unth.edu.ng",
  emergencyNumber: "0703 132 2008",
  colors: {
    primary: "#0E9F6E", // Green - medical/health color
    secondary: "#DC2626", // Red - emergency/alert color
    accent: "#1E40AF" // Blue - professional color
  },
  motto: "Service to Humanity",
  established: "1970"
};