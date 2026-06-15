/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      screens: {
        xs: '481px',   // tablet threshold for grid / layout switches
      },
      colors: {
        omnom: {
          bg: '#FEF3E3',
          orange: '#F48924',
          'orange-dark': '#D9750E',
          brown: '#3D1A00',
          'brown-mid': '#6F3B16',
          cream: '#FFF1DD',
          'cream-dark': '#E5CDA5',
        },
      },
      fontFamily: {
      display: ['Nunito', 'sans-serif'],
      sans: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        card: '0 20px 50px rgba(149,104,33,0.12)',
        'card-sm': '0 10px 30px rgba(149,104,33,0.10)',
        orange: '0 16px 30px rgba(244,137,36,0.34)',
      },
    },
  },
  plugins: [],
};
