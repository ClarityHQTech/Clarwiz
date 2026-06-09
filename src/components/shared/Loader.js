import React from "react";

const Loader = ({
  size = 30,
  ringSize = 50,
  fullScreen = false,
  className = "",
}) => {
  const logoStyle = {
    width: `${size}px`,
    height: `${size}px`,
  };

  const ringStyle = {
    width: `${ringSize}px`,
    height: `${ringSize}px`,
  };

  return (
    <div
      className={`h-[100vh] flex items-center justify-center ${
        fullScreen ? "fixed inset-0 bg-brand-bg/90 z-50" : ""
      } ${className}`}
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="relative flex items-center justify-center">
        <div
          style={ringStyle}
          className="absolute rounded-full border-4 border-gray-600 border-t-transparent animate-spin"
        />
        <img
          src="/logo.svg"
          alt="Loading"
          style={logoStyle}
          className="relative object-contain"
        />
      </div>
    </div>
  );
};

export default Loader;
