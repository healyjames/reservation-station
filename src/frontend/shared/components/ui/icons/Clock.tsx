import type { FunctionComponent } from 'preact';
import Icon, { type IconProps } from './Icon';

const Clock: FunctionComponent<IconProps> = (props) => (
  <Icon {...props} name="clock">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </Icon>
);

export default Clock;
