import type { FunctionComponent } from 'preact';
import Icon, { type IconProps } from './Icon';

const ChevronLeft: FunctionComponent<IconProps> = (props) => (
  <Icon {...props} name="chevron-left">
    <path d="m15 18-6-6 6-6" />
  </Icon>
);

export default ChevronLeft;
