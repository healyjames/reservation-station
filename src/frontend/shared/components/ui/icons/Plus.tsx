import type { FunctionComponent } from 'preact';
import Icon, { type IconProps } from './Icon';

const Plus: FunctionComponent<IconProps> = (props) => (
  <Icon {...props} name="plus">
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </Icon>
);

export default Plus;
