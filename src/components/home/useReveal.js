import { useEffect, useRef } from 'react';

// Fades in every [data-reveal] element inside the ref as it scrolls into view.
export default function useReveal(dependency) {
  const root = useRef(null);
  useEffect(() => {
    const nodes = root.current?.querySelectorAll('[data-reveal]:not(.vh-in)');
    if (!nodes?.length) return undefined;
    if (typeof IntersectionObserver === 'undefined') { nodes.forEach(node => node.classList.add('vh-in')); return undefined; }
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('vh-in'); observer.unobserve(entry.target); }
    }), { threshold: 0.12 });
    nodes.forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, [dependency]);
  return root;
}
