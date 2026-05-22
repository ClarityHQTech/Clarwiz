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
        fullScreen ? "fixed inset-0 bg-white/80 z-50" : ""
      } ${className}`}
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="relative flex items-center justify-center">
        {/* Rotating cyan ring */}
        <div
          style={ringStyle}
          className="absolute rounded-full border-4 border-sky-600 border-t-transparent animate-spin"
        />

        {/* Logo sits centered above the ring */}
        <img
          src={'/logo.svg'}
          alt="logo"
          style={logoStyle}
          className="relative object-contain"
        />
      </div>
    </div>
  );
};

export default Loader;
