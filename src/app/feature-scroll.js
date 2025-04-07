// Feature scroll animation
document.addEventListener('DOMContentLoaded', () => {
  const featureContents = document.querySelectorAll('.feature-content');
  
  if (featureContents.length === 0) return;

  // Create intersection observer for each feature content
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // Add active class to current section
        entry.target.classList.add('active');
        
        // Fade in content
        const content = entry.target.querySelector('.transform');
        if (content) {
          content.style.opacity = '1';
          content.style.transform = 'translateY(0)';
        }
      } else {
        // Remove active class from other sections
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
    threshold: 0.5
  });
  
  // Set initial state and observe each feature content
  featureContents.forEach((content, index) => {
    // Set initial state
    const contentDiv = content.querySelector('.transform');
    if (contentDiv) {
      if (index === 0) {
        contentDiv.style.opacity = '1';
        contentDiv.style.transform = 'translateY(0)';
        content.classList.add('active');
      } else {
        contentDiv.style.opacity = '0';
        contentDiv.style.transform = 'translateY(20px)';
      }
    }
    
    observer.observe(content);
  });
}); 