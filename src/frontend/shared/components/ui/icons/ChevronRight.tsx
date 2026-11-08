import type { FunctionComponent } from 'preact';
import Icon, { type IconProps } from './Icon';

const ChevronRight: FunctionComponent<IconProps> = (props) => (
  <Icon {...props} name="chevron-right">
    <path d="m9 18 6-6-6-6" />
  </Icon>
);

export default ChevronRight;
