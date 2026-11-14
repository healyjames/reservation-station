import type { FunctionComponent } from 'preact';
import Icon, { type IconProps } from './Icon';

const Menu: FunctionComponent<IconProps> = (props) => (
  <Icon {...props} name="menu">
    <line x1="4" x2="20" y1="12" y2="12" />
    <line x1="4" x2="20" y1="6" y2="6" />
    <line x1="4" x2="20" y1="18" y2="18" />
  </Icon>
);

export default Menu;
