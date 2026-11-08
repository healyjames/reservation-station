import type { FunctionComponent } from 'preact';
import Icon, { type IconProps } from './Icon';

const CircleCheck: FunctionComponent<IconProps> = (props) => (
  <Icon {...props} name="circle-check">
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </Icon>
);

export default CircleCheck;
