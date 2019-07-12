'use strict'

const React = require('react')
const { Table, Input, Button, Icon, Badge, Divider, Popconfirm } = require('antd')
const Highlighter = require('react-highlight-words')
const { array, func } = require('prop-types')
const { getTaskStatusDesc, getTaskStatusBadge } = require('../../common/dataUtil')

class TasksTable extends React.Component {
  state = {
    searchText: '',
  }

  getColumnSearchProps = (dataIndex) => ({
    filterDropdown: ({
                       setSelectedKeys, selectedKeys, confirm, clearFilters,
                     }) => (
                       <div style={{ padding: 8 }}>
                         <Input
                           ref={node => { this.searchInput = node }}
                           placeholder={`Search ${dataIndex}`}
                           value={selectedKeys[0]}
                           onChange={e => setSelectedKeys(
            e.target.value ? [e.target.value] : [])}
                           onPressEnter={() => this.handleSearch(selectedKeys, confirm)}
                           style={{ width: 188, marginBottom: 8, display: 'block' }}/>
                         <Button
                           type="primary"
                           onClick={() => this.handleSearch(selectedKeys, confirm)}
                           icon="search"
                           size="small"
                           style={{ width: 90, marginRight: 8 }}>
          Search
                         </Button>
                         <Button
                           onClick={() => this.handleReset(clearFilters)}
                           size="small"
                           style={{ width: 90 }}>
          Reset
                         </Button>
                       </div>
    ),
    filterIcon: filtered => <Icon type="search" style={{
      color: filtered
        ? '#1890ff'
        : undefined,
    }}/>,
    onFilter: (value, record) => record[dataIndex].toString()
      .toLowerCase()
      .includes(value.toLowerCase()),
    onFilterDropdownVisibleChange: (visible) => {
      if (visible) {
        setTimeout(() => this.searchInput.select())
      }
    },
    render: (text) => (
      <Highlighter
        highlightStyle={{ backgroundColor: '#ffc069', padding: 0 }}
        searchWords={[this.state.searchText]}
        autoEscape
        textToHighlight={text.toString()}/>
    ),
  })

  handleSearch = (selectedKeys, confirm) => {
    confirm()
    this.setState({ searchText: selectedKeys[0] })
  }

  handleReset = (clearFilters) => {
    clearFilters()
    this.setState({ searchText: '' })
  }

  checkProject = (projectId)=>{
    this.props.openProjectById(projectId)
  }

  auditTask = (task)=>{
    this.props.onPassTask(task)
  }

  rollbackTask = (task)=>{
    this.props.onRollbackTask(task)
  }

  render() {
    const columns = [
      {
        key: 'name',
        title: '名称',
        dataIndex: 'name',
        width: '20%',
        ...this.getColumnSearchProps('name'),
      }, {
        title: '项目',
        dataIndex: 'project.name',
        key: 'project.name',
        width: '20%',
      }, {
        title: '进度',
        dataIndex: 'progress',
        key: 'progress',
        width: '15%',
      }, {
        title: '状态',
        dataIndex: 'workStatus',
        key: 'workStatus',
        width: '20%',
        render: (text, record) => (
          <div><Badge status={getTaskStatusBadge(record.workStatus)} text={getTaskStatusDesc(record.workStatus)} /></div>
        ),
      }, {
        title: '操作',
        key: 'action',
        width: '20%',
        render: (text, record) => (
          <span>
            <Popconfirm placement="top" title={'审核任务'} onConfirm={()=>this.auditTask(record)} okText="通过" cancelText="取消">
              <a href="javascript:;">审核</a>
            </Popconfirm>
            <Divider type="vertical" />
            <Popconfirm placement="top" title={'撤回任务'} onConfirm={()=>this.rollbackTask(record)} okText="撤回" cancelText="取消">
              <a href="javascript:;">撤回</a>
            </Popconfirm>
            <Divider type="vertical" />
            <a href="javascript:;" onClick={()=>this.checkProject(record.project.projectId)}>查看</a>
          </span>
        ),
      }]
    return <Table columns={columns} dataSource={this.props.tasks}/>
  }
  static propTypes = {
    tasks: array.isRequired,
    openProjectById: func.isRequired,
    onPassTask: func.isRequired,
    onRollbackTask: func.isRequired
  }
}

module.exports = {
  TasksTable,
}
