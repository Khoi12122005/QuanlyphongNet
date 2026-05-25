import { useEffect, useState } from 'react';

export default function MouseGlow() {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <>
      <div 
        className="mouse-glow-background"
        style={{
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(0, 240, 255, 0.05), transparent 40%)`
        }}
      />
      <div 
        className="mouse-glow-cursor"
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`
        }}
      />
    </>
  );
}
