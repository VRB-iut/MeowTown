const COLOR = {
  light: {
    background: '#f8f8f8',
    text: '#0e0e0e',
    primary: '#53b5e7',
    primaryDark: '#49b1e6',
    secondary: '#A7A5C6',
    gray: '#bfbfbf',
    selected: '#82c7ea',
    unselected: '#c9cee6',
    tabBar: '#ffffff',
    usersPost: '#a39999',
    debugging: '#780116',
  },
  dark: {
    background: '#212121',
    text: '#f8f8f8',
    primary: '#00AFB9',
    primaryDark: '#00a0a8',
    secondary: '#0081A7',
    gray: '#bfbfbf',
    selected: '#00c7d1',
    unselected: '#4a4a4d',
    tabBar: '#101010',
    usersPost: '#a39999',
    debugging: '#780116',
  }
};

function applyPureBlack(enable = false) {
  if (enable) {
    // Override both themes to use pure black background and white text
    COLOR.dark.background = '#000000';
    COLOR.dark.tabBar = '#000000';
    COLOR.dark.text = '#ffffff';

    COLOR.light.background = '#000000';
    COLOR.light.tabBar = '#000000';
    COLOR.light.text = '#ffffff';
  } else {
    // Restore defaults
    COLOR.light.background = '#f8f8f8';
    COLOR.light.text = '#0e0e0e';
    COLOR.light.tabBar = '#ffffff';

    COLOR.dark.background = '#212121';
    COLOR.dark.text = '#f8f8f8';
    COLOR.dark.tabBar = '#101010';
  }
}

export { applyPureBlack };
export default COLOR;