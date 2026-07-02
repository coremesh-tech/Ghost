import MainLayout from '@components/layout/main-layout';
import React from 'react';
import TagsList from './components/tags-list';
import {Button, DropdownMenuCheckboxItem, EmptyIndicator, LoadingIndicator, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, ToggleGroup, ToggleGroupItem} from '@tryghost/shade/components';
import {Link, useSearchParams} from '@tryghost/admin-x-framework';
import {ListPage} from '@tryghost/shade/page-templates';
import {LucideIcon} from '@tryghost/shade/utils';
import {PageHeader} from '@tryghost/shade/patterns';
import {useBrowseTags} from '@tryghost/admin-x-framework/api/tags';

const Tags: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const type = searchParams.get('type') ?? 'public';
    // pm.org 分类维度筛选(独立于 visibility 的 public/internal)
    const dimension = searchParams.get('dimension') ?? 'all';

    // NQL: 逗号是 OR、加号是 AND。多条件必须用 + 才是「且」。
    // useBrowseTags 用逗号拼接对象 filter,这里自己拼 + 并通过 searchParams 覆盖。
    const filterString = dimension === 'all'
        ? `visibility:${type}`
        : `visibility:${type}+type:${dimension}`;

    const {
        data,
        isError,
        isLoading,
        isFetchingNextPage,
        fetchNextPage,
        hasNextPage
    } = useBrowseTags({
        filter: {visibility: type},
        searchParams: {filter: filterString}
    });

    const setDimension = (value: string) => {
        const params: Record<string, string> = {};
        if (type !== 'public') {
            params.type = type;
        }
        if (value !== 'all') {
            params.dimension = value;
        }
        setSearchParams(params);
    };

    return (
        <MainLayout>
            <ListPage data-testid="tags-page">
                <ListPage.Header>
                    <PageHeader blurredBackground={false} sticky={false}>
                        <PageHeader.Left>
                            <PageHeader.Title>Tags</PageHeader.Title>
                        </PageHeader.Left>
                        <PageHeader.Actions>
                            <PageHeader.ActionGroup>
                                <Select value={dimension} onValueChange={setDimension}>
                                    <SelectTrigger className="w-[150px]" data-testid="tags-type-filter">
                                        <SelectValue placeholder="All types" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All types</SelectItem>
                                        <SelectItem value="genre">Genre</SelectItem>
                                        <SelectItem value="segment">Segment</SelectItem>
                                        <SelectItem value="topic">Topic</SelectItem>
                                        <SelectItem value="function">Function</SelectItem>
                                    </SelectContent>
                                </Select>
                                <ToggleGroup data-testid="tags-header-tabs" size='button' type="single" value={type}>
                                    <ToggleGroupItem aria-label="Public tags" value="public" asChild>
                                        <Link to="/tags">Public tags</Link>
                                    </ToggleGroupItem>
                                    <ToggleGroupItem aria-label="Internal tags" value="internal" asChild>
                                        <Link to="/tags?type=internal">Internal tags</Link>
                                    </ToggleGroupItem>
                                </ToggleGroup>
                                <PageHeader.ActionGroup.MobileMenu>
                                    <PageHeader.ActionGroup.MobileMenuTrigger>
                                        <Button variant='outline'>
                                            <LucideIcon.MoreHorizontal className='size-4' />
                                        </Button>
                                    </PageHeader.ActionGroup.MobileMenuTrigger>
                                    <PageHeader.ActionGroup.MobileMenuContent>
                                        <DropdownMenuCheckboxItem
                                            checked={type === 'public'}
                                            onCheckedChange={() => setSearchParams({})}
                                        >
                                            Public tags
                                        </DropdownMenuCheckboxItem>
                                        <DropdownMenuCheckboxItem
                                            checked={type === 'internal'}
                                            onCheckedChange={() => setSearchParams({type: 'internal'})}
                                        >
                                            Internal tags
                                        </DropdownMenuCheckboxItem>
                                    </PageHeader.ActionGroup.MobileMenuContent>
                                </PageHeader.ActionGroup.MobileMenu>
                            </PageHeader.ActionGroup>
                            <PageHeader.ActionGroup>
                                <Button asChild>
                                    <a className="font-bold" href="#/tags/new">
                                        <LucideIcon.Plus className='size-4' />
                                        <span className='hidden sm:inline'>New tag</span>
                                    </a>
                                </Button>
                            </PageHeader.ActionGroup>
                        </PageHeader.Actions>
                    </PageHeader>
                </ListPage.Header>
                <ListPage.Body>
                    {isLoading ? (
                        <div className="flex flex-1 items-center justify-center">
                            <LoadingIndicator size="lg" />
                        </div>
                    ) : isError ? (
                        <div className="flex flex-1 flex-col items-center justify-center">
                            <h2 className="mb-2 text-xl font-medium">
                                Error loading tags
                            </h2>
                            <p className="mb-4 text-muted-foreground">
                                Please reload the page to try again
                            </p>
                            <Button onClick={() => window.location.reload()}>
                                Reload page
                            </Button>
                        </div>
                    ) : !data?.tags.length ? (
                        <div className="flex flex-1 items-center justify-center">
                            <EmptyIndicator
                                actions={
                                    <Button asChild>
                                        <a href="#/tags/new">Create a new tag</a>
                                    </Button>
                                }
                                title="Start organizing your content"
                            >
                                <LucideIcon.Tags />
                            </EmptyIndicator>
                        </div>
                    ) : (
                        <TagsList
                            fetchNextPage={fetchNextPage}
                            hasNextPage={hasNextPage}
                            isFetchingNextPage={isFetchingNextPage}
                            items={data?.tags ?? []}
                            totalItems={data?.meta?.pagination?.total ?? 0}
                        />
                    )}
                </ListPage.Body>
            </ListPage>
        </MainLayout>
    );
};

export default Tags;
