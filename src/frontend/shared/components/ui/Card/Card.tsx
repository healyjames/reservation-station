import type { ComponentChildren, FunctionComponent, JSX } from 'preact';
import { cx } from '@shared/utils/cx';

/** `p` renders the title as bold text that is not a heading, e.g. a row inside a list of settings. */
export type CardTitleTag = 'h1' | 'h2' | 'h3' | 'h4' | 'p';
/** `section` and `article` are landmarks/regions; use them only where the card is one. */
export type CardElement = 'div' | 'section' | 'article';

type OwnedAttributes = 'class' | 'className' | 'title';

type CardTitle =
  | { title?: undefined; titleAs?: undefined }
  | {
      /** Shown first, in `card-title`. */
      title: ComponentChildren;
      /** Required with `title`: the element that fits the page outline (`p` = not a heading). */
      titleAs: CardTitleTag;
    };

export type CardProps = Omit<JSX.HTMLAttributes<HTMLElement>, OwnedAttributes> &
  CardTitle & {
    /**
     * Classes for the card root. daisyUI's card sets no background, so pass one (e.g. `bg-base-100`). Override the body
     * padding with `[--card-p:1rem]`.
     */
    class?: string;
    as?: CardElement;
    /** Thin `base-200` border (`card-border`). */
    bordered?: boolean;
    /** Controls shown last, in `card-actions`. */
    actions?: ComponentChildren;
  };

/** daisyUI card: root, `card-body`, optional `card-title` and `card-actions`. */
const Card: FunctionComponent<CardProps> = ({
  as: Root = 'div',
  title,
  titleAs: TitleTag,
  bordered = false,
  actions,
  class: className,
  children,
  ...rest
}) => (
  <Root {...rest} class={cx('card', bordered && 'card-border', className)}>
    {/* app.css restores browser margins on headings and paragraphs; card-body's gap does the spacing, so direct
        children drop theirs. daisyUI grows `.card-body p` to fill spare height, which a `p` title must not. */}
    <div class="card-body *:my-0">
      {title && TitleTag && <TitleTag class="card-title grow-0">{title}</TitleTag>}
      {children}
      {actions && <div class="card-actions">{actions}</div>}
    </div>
  </Root>
);

export default Card;
