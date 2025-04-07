// Feature scroll animation
document.addEventListener('DOMContentLoaded', () => {
  const featureContents = document.querySelectorAll('.feature-content');
  
  if (featureContents.length === 0) return;

  // Create intersection observer for each feature content
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // Make current section fully visible
        entry.target.style.opacity = '1';
        entry.target.style.zIndex = '10';
        entry.target.classList.add('active');
        
        // Fade in content
        const content = entry.target.querySelector('.transform');
        if (content) {
          content.style.opacity = '1';
          content.style.transform = 'translateY(0)';
        }
      } else {
        // Hide non-visible sections
        entry.target.style.opacity = '0';
        entry.target.style.zIndex = '1';
        entry.target.classList.remove('active');
        
        // Fade out content
        const content = entry.target.querySelector('.transform');
        if (content) {
          content.style.opacity = '0';
          content.style.transform = 'translateY(20px)';
        }
      }
    });
  }, {
    threshold: 0.25,
    rootMargin: '-20% 0px'
  });
  
  // Set initial state and observe each feature content
  featureContents.forEach((content, index) => {
    // Add transition properties to feature content
    content.style.transition = 'opacity 0.4s ease-in-out, transform 0.4s ease-in-out';
    
    // Set initial state
    if (index === 0) {
      content.style.opacity = '1';
      content.style.zIndex = '10';
      content.classList.add('active');
      const contentDiv = content.querySelector('.transform');
      if (contentDiv) {
        contentDiv.style.opacity = '1';
        contentDiv.style.transform = 'translateY(0)';
      }
    } else {
      content.style.opacity = '0';
      content.style.zIndex = '1';
      const contentDiv = content.querySelector('.transform');
      if (contentDiv) {
        contentDiv.style.opacity = '0';
        contentDiv.style.transform = 'translateY(20px)';
      }
    }
    
    observer.observe(content);
  });
}); 